import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../features/appearance/types";
import { ModuleSwitchSection } from "./ModuleSwitchSection";

/** Search: the module switch and how queries and the index work. */
export function SearchSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();

  return (
    <>
      <ModuleSwitchSection
        label={t.settings.modules.search}
        checked={settings.searchEnabled}
        onChange={(searchEnabled) => onSettingsChange({ ...settings, searchEnabled })}
      />
      {settings.searchEnabled && (
        <SettingsGroup title={t.settings.categories.search}>
          <SettingsRow title={t.fileSearch.islandPageHint} description={t.fileSearch.hint} />
          <SettingsRow title={t.fileSearch.searchLabel} description={t.fileSearch.hintSyntax} />
        </SettingsGroup>
      )}
      <SettingsGroup title={t.filePreview.title}>
        <SettingsRow title={t.filePreview.shortcut} description={t.filePreview.settingsHint} />
        <SettingsRow title={t.filePreview.formats} />
      </SettingsGroup>
    </>
  );
}
