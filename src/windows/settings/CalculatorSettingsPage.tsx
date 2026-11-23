import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../features/appearance/types";
import { ModuleSwitchSection } from "./ModuleSwitchSection";

/** Calculator: the module switch, and what the page and its keypad take. */
export function CalculatorSettingsPage({
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
        label={t.settings.modules.calculator}
        checked={settings.calculatorEnabled}
        onChange={(calculatorEnabled) => onSettingsChange({ ...settings, calculatorEnabled })}
      />
      {settings.calculatorEnabled && (
        <SettingsGroup title={t.settings.categories.calculator}>
          <SettingsRow title={t.calculator.operators} description={t.calculator.hint} />
        </SettingsGroup>
      )}
    </>
  );
}
