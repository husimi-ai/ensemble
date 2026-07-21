"use client";

import { useState } from "react";
import { SettingRow, SelectControl } from "@/components/settings/SettingRow";
import { Toggle } from "@/components/ui/Toggle";

export function GeneralPanel() {
  const [higher, setHigher] = useState(true);
  const [dictation, setDictation] = useState(true);

  return (
    <div>
      <SettingRow title="Appearance" control={<SelectControl value="Light" />} />
      <SettingRow title="Contrast" control={<SelectControl value="System" />} />
      <SettingRow title="Accent color" control={<SelectControl value="Default" dot />} />
      <SettingRow title="Language" control={<SelectControl value="Auto-detect" />} />
      <SettingRow
        title="Higher intelligence"
        description="Ensemble can automatically use a higher intelligence setting when you ask a complex question."
        control={<Toggle checked={higher} onChange={setHigher} label="Higher intelligence" />}
      />
      <SettingRow
        title="Enable Dictation"
        description="Use dictation in the chat composer."
        divider={false}
        control={<Toggle checked={dictation} onChange={setDictation} label="Enable Dictation" />}
      />
    </div>
  );
}
