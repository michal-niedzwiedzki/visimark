import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  RootsListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { errorEnvelopeOf } from "./envelope.js";
import { closedGate, type Gate } from "./gate.js";
import { PROMPTS, promptFor } from "./prompts.js";
import { RESOURCES, readResource, resourceFor } from "./resources.js";
import { READ_TOOLS } from "./tools/read.js";
import type { ToolDef } from "./tools/types.js";
import { writeTools } from "./tools/write.js";
import { serverVersion } from "./version.js";

/**
 * The transport-facing half. Everything it serves is defined elsewhere and
 * tested without a transport; this module's job is the protocol and the one
 * piece of state that only the protocol can supply — the host's declared
 * roots, which the agent cannot reach and cannot set.
 */

export interface ServerDeps {
  readonly allowWrite: boolean;
}

/** Mutable only from `roots/list`, which is the host talking, never a tool. */
class Roots {
  private declared: string[] = [];

  get gate(): Gate {
    return { allowWrite: this.allowWrite, roots: this.declared };
  }

  constructor(private readonly allowWrite: boolean) {}

  set(paths: readonly string[]): void {
    this.declared = [...paths];
  }
}

function fileUriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file://")) return undefined;
  try {
    return decodeURIComponent(new URL(uri).pathname);
  } catch {
    return undefined;
  }
}

/**
 * A tool result. A fault is `isError: true` carrying the envelope's `error`
 * object, and nothing else is — a document with findings came back as a
 * successful call long before here (§3.1).
 */
function resultFor(tool: ToolDef, args: unknown): object {
  const outcome = tool.run(args);
  if ("fault" in outcome) {
    const body = errorEnvelopeOf(tool.name.replace(/^visimark_/, ""), outcome.fault);
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
      structuredContent: body,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(outcome.ok, null, 2) }],
    structuredContent: outcome.ok,
  };
}

export function createServer(deps: ServerDeps): {
  server: Server;
  connect(transport: Transport): Promise<void>;
} {
  const roots = new Roots(deps.allowWrite);
  const server = new Server(
    { name: "visimark", version: serverVersion() },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions:
        "VisiMark makes a number in a Markdown document carry the formula that produced it, " +
        "so a machine can prove the two still agree. Read the `visimark://skill` resource " +
        "before authoring or editing a document: the verifier without the authoring " +
        "discipline is a green check that proves agreement, not derivation.",
    },
  );

  const tools = (): ToolDef[] => [...READ_TOOLS, ...writeTools(roots.gate)];

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools().map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { title: t.title, ...t.annotations },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const tool = tools().find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: "text", text: `visimark: unknown tool ${request.params.name}` }],
      };
    }
    return resultFor(tool, request.params.arguments ?? {});
  });

  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      title: r.title,
      description: r.description,
      mimeType: r.mimeType,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, (request) => {
    const def = resourceFor(request.params.uri);
    if (!def) throw new Error(`visimark: unknown resource ${request.params.uri}`);
    return {
      contents: [{ uri: def.uri, mimeType: def.mimeType, text: readResource(def) }],
    };
  });

  server.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: PROMPTS.map((p) => ({
      name: p.name,
      title: p.title,
      description: p.description,
      arguments: [...p.arguments],
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, (request) => {
    const prompt = promptFor(request.params.name);
    if (!prompt) throw new Error(`visimark: unknown prompt ${request.params.name}`);
    return {
      description: prompt.description,
      messages: [
        {
          role: "user",
          content: { type: "text", text: prompt.render(request.params.arguments ?? {}) },
        },
      ],
    };
  });

  /**
   * The roots half of the gate. Asked for once the handshake completes, and
   * re-asked whenever the host says they changed. A host that declares no
   * roots capability leaves the list empty, which is the closed state — and
   * that is the intended reading, not a degradation.
   */
  const refreshRoots = async (): Promise<void> => {
    if (!server.getClientCapabilities()?.roots) return;
    try {
      const result = await server.listRoots();
      const paths: string[] = [];
      for (const root of result.roots) {
        const path = fileUriToPath(root.uri);
        if (path !== undefined) paths.push(path);
      }
      roots.set(paths);
    } catch {
      // A host that advertises roots and then refuses to list them has not
      // declared a blast radius either. Staying closed is the safe reading.
      roots.set([]);
    }
  };

  server.oninitialized = () => void refreshRoots();
  server.setNotificationHandler(RootsListChangedNotificationSchema, () => void refreshRoots());

  return {
    server,
    async connect(transport: Transport): Promise<void> {
      await server.connect(transport);
    },
  };
}

export { closedGate };
