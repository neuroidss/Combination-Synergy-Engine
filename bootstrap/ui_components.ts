import { CHRONICLER_UI_CODE } from './ui_chronicler';
import { MAIN_PANEL_CODE } from './ui_main_panel';

export const SYNERGY_FORGE_UI_CODE = `
// The Chronicler agent's logic and UI component are defined first,
// so they are in scope for the Main UI component that uses them.
${CHRONICLER_UI_CODE}

// The main UI panel, which renders the Chronicler component, follows.
${MAIN_PANEL_CODE}
`;
