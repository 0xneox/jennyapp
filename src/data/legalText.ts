import { APP_NAME } from '../utils/theme';

/**
 * In-app legal documents, rendered by LegalDocumentModal and mirrored by the
 * static pages in public/*.html for web hosting (the Play Store listing needs
 * a public privacy policy URL).
 *
 * Public policy URL: https://jennydoko.fun/privacy.html
 * Public terms URL:  https://jennydoko.fun/terms.html
 */
export const CONTACT_EMAIL = 'neohex262@pm.me';
export const LEGAL_ENTITY = '21b Labs';
export const LEGAL_LAST_UPDATED = 'October 10, 2026';

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      heading: 'The short version',
      body: `${APP_NAME} is a puzzle game supported by ads that can be played fully offline. We never ask for your name, email, or any account. Your progress, settings, and stats stay on your device unless you choose to join the optional global leaderboard, which shares only a made-up player name, a cartoon avatar, and your game points (see "Optional global leaderboard"). We never sell data. Ads are served by Google AdMob, which processes limited device data to deliver and measure ads (see "Advertising" below).`,
    },
    {
      heading: 'Optional global leaderboard',
      body: `The leaderboard is off until you tap "Join the Leaderboard". If you join, the app sends the following to our leaderboard server (hosted by Supabase):\n\n• A random ID created on your device (stored only as a one-way hash, not linked to your device, advertising ID, or any account)\n• Your player name, chosen only from a fixed list of friendly words plus a number — you can't type free text\n• Your chosen cartoon avatar\n• Your best score on each level and the dates you completed the Daily Garden, used to calculate your points\n\nOther players can see your player name, avatar, rank, and points. As with any internet connection, the server receives your IP address to answer requests; we don't store it with your leaderboard entry.\n\nYou can leave at any time from the Leaderboard → your avatar → "Leave leaderboard & delete my scores". This permanently deletes your leaderboard entry and scores from the server.`,
    },
    {
      heading: 'What is stored on your device',
      body: 'The game saves the following locally on your device (not sent to us or anyone else, except the leaderboard data listed above if you join):\n\n• Level progress and unlocked levels\n• Game mode, sound, and music settings\n• Daily challenge streaks and stats\n• Story and tutorial "seen" flags\n• Your ad consent choice (where consent is required)\n• Your leaderboard player name, avatar, and random ID\n\nThis data lives in your browser\'s local storage (web) or the app\'s private storage (Android/iOS).',
    },
    {
      heading: 'Advertising (Google AdMob)',
      body: `${APP_NAME} shows ads provided by Google AdMob — banners, occasional interstitials between levels, and rewarded ads you can choose to watch for extra hints. To serve and measure ads, Google and its partners may process your device's advertising ID, IP address, and ad interaction data. Ad content is capped at a family-appropriate rating.\n\n• Where required by law (EEA, UK, Switzerland), a consent form lets you choose between personalized and non-personalized ads.\n• You can review or change your choice any time from Settings → Privacy & Ads.\n• No rewarded-ad reward is granted unless the ad finishes playing.\n\nSee how Google uses data: https://policies.google.com/technologies/partner-sites`,
    },
    {
      heading: 'What we do NOT collect',
      body: `• No accounts, sign-ups, names, or email addresses\n• No free-text input of any kind\n• No analytics or tracking by us\n• No location data\n• No contacts, photos, or files\n• No crash reporting sent to third parties\n\n(Our ad partner Google processes its own data under Google's policies — see "Advertising".)`,
    },
    {
      heading: 'Children\'s privacy',
      body: `${APP_NAME} does not collect personal information from anyone, including children under 13, and the game can be played fully offline. The optional leaderboard was designed for kids: names can only be built from a fixed list of friendly words, avatars are cartoons, and nothing identifies the player in real life. Ads shown are limited to a family-appropriate content rating.`,
    },
    {
      heading: 'Data Safety (Play Store)',
      body: 'For the Play Console Data Safety form: the app shares the device advertising ID with Google AdMob for advertising purposes. If the player joins the optional leaderboard, the app collects in-game app activity (a made-up player name, avatar, scores, and daily completion dates) and a random app-generated ID, used only to run the leaderboard. This data is encrypted in transit, is not shared with third parties or sold, and can be deleted in-app at any time.',
    },
    {
      heading: 'Deleting your data',
      body: 'To delete your leaderboard data, open Leaderboard → your avatar → "Leave leaderboard & delete my scores". Uninstalling the app removes all locally stored data (if you uninstall without leaving the leaderboard first, email us your player name and we will remove that entry). On the web version, clearing your browser\'s site data removes local data.',
    },
    {
      heading: 'Changes to this policy',
      body: `If ${APP_NAME} adds new online features, this policy will be updated before those features ship, and any new data handling will be described here.`,
    },
    {
      heading: 'Contact',
      body: `Questions about privacy? Contact ${LEGAL_ENTITY} at ${CONTACT_EMAIL}, or visit jennydoko.fun.`,
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      heading: 'Agreement',
      body: `By playing ${APP_NAME} you agree to these terms. If you don't agree, please don't play — though we'll be sad to see you go.`,
    },
    {
      heading: 'License to play',
      body: `${LEGAL_ENTITY} grants you a personal, non-exclusive, non-transferable license to install and play ${APP_NAME} for your own entertainment. You may not copy, redistribute, sell, or reverse-engineer the game or its artwork.`,
    },
    {
      heading: 'Your progress',
      body: 'Game progress is stored only on your device. We are not responsible for progress lost through uninstalling, clearing storage, device changes, or device failure.',
    },
    {
      heading: 'Acceptable use',
      body: 'Please don\'t use the game for anything unlawful, and don\'t attempt to disrupt it for other players.',
    },
    {
      heading: 'Advertising',
      body: 'The game is supported by advertising served through Google AdMob. Optional rewarded ads grant in-game bonuses such as extra hints; a reward is granted only when the ad completes. Ad availability depends on your region, consent choices, and network connectivity.',
    },
    {
      heading: 'No warranty',
      body: `${APP_NAME} is provided "as is" without warranties of any kind. We do our best to keep every puzzle solvable and bug-free, but we can't promise perfection.`,
    },
    {
      heading: 'Changes',
      body: `We may update the game or these terms from time to time. Continued play after an update means you accept the new terms.`,
    },
    {
      heading: 'Contact',
      body: `Questions about these terms? Contact ${LEGAL_ENTITY} at ${CONTACT_EMAIL}, or visit jennydoko.fun.`,
    },
  ],
};
