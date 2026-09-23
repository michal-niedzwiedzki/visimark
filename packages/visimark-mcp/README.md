# visimark-mcp

A stdio [MCP](https://modelcontextprotocol.io) server exposing the
[VisiMark](https://github.com/michal-niedzwiedzki/visimark) engine to agents:
every `visimark` command as a tool, the authoring discipline as resources, and
the two orderings an agent gets wrong unsupplied as prompts.

Read-only unless an operator deliberately opens the write gate.

## Install

```console
$ npm i -g visimark-mcp   # or: bun add -g visimark-mcp
```

## Run

```console
$ npx visimark-mcp        # or: bunx visimark-mcp
$ claude mcp add visimark -- npx -y visimark-mcp
```

Writes are off unless the server is started with `--allow-write` **and** the
host declares at least one MCP root. No roots means no writes.

See [`docs/mcp.md`](https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/mcp.md)
for the full surface.

## License

MIT
