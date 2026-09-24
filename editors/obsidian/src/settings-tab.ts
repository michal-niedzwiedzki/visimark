import { PluginSettingTab, Setting, type App } from "obsidian";
import type VisiMarkPlugin from "./main.js";

/**
 * Spec §2.5's three real toggles — `writeChartArtifacts` is fixed, not a
 * setting (see `settings.ts`).
 */
export class VisiMarkSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: VisiMarkPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Format on explicit save")
      .setDesc(
        "Apply every repair fmt would make — the same plan the Format command runs — when you press " +
          "Ctrl/Cmd+S with a VisiMark note focused. An autosave never triggers this. Saving another way, " +
          "such as the command palette's “Save file,” does not either: Obsidian has no event for " +
          "an explicit save distinct from autosave, so this listens for the keystroke specifically.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.formatOnSave).onChange(async (value) => {
          this.plugin.settings.formatOnSave = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Show provenance in Live Preview")
      .setDesc(
        "Mark a computed value while you type, the same way reading mode always does. Turn off if the " +
          "anchor comment behind a mark reads badly as literal text next to it.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showProvenanceInLivePreview)
          .onChange(async (value) => {
            this.plugin.settings.showProvenanceInLivePreview = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Sweep the vault on open")
      .setDesc("Start a vault-wide check automatically each time this vault opens.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.sweepOnOpen).onChange(async (value) => {
          this.plugin.settings.sweepOnOpen = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
