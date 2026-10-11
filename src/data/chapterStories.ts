import { Chapter } from './chapterData';

export interface ChapterStoryPage {
  chapter: string;
  headline: string;
  dialogue: string;
  highlightColor: string;
  emoji: string;
}

export interface ChapterStory {
  chapterId: number;
  title: string;
  pages: ChapterStoryPage[];
}

/**
 * Chapter intro stories for mechanic debut chapters.
 * These fire the first time a player enters the chapter.
 *
 * Chapter 11 (Level 201): Grumpy Cats debut
 * Chapter 16 (Level 301): Linked Beds debut
 * Chapter 21 (Level 401): Cats + Linked combo
 * Chapter 31 (Level 601): Twin Puppies debut
 * Chapter 41 (Level 801): Twin Puppies + Cats
 * Chapter 46 (Level 901): Grand Championship (twins + cats + linked)
 * Chapter 51 (Level 1001): Encore Expedition begins (triple linked beds)
 * Chapter 52 (Level 1021): Hungry Beds debut (pond 0 + feast 4)
 * Chapter 56 (Level 1101): Lighter beds (3 / 1 pairs)
 */
export const CHAPTER_STORIES: ChapterStory[] = [
  {
    chapterId: 11,
    title: 'Grumpy Cats Arrive!',
    pages: [
      {
        chapter: 'Chapter 11 • Maple Glade',
        headline: 'A grumpy cat naps in the meadow! 😾',
        dialogue: 'Oh no! Whiskers the cat has moved in! She hates puppies near her — no pup can sit in any of the 8 cells around her!',
        highlightColor: '#EF5350',
        emoji: '😾',
      },
      {
        chapter: 'Chapter 11 • Maple Glade',
        headline: 'Cats need personal space!',
        dialogue: 'See the red glow? That\'s Whiskers\'s personal space zone. Place puppies carefully — they can\'t touch her, not even diagonally!',
        highlightColor: '#EF5350',
        emoji: '🚫',
      },
      {
        chapter: 'Chapter 11 • Maple Glade',
        headline: 'You\'ve got this!',
        dialogue: 'The cats add a new challenge, but you\'re a pro puppy sitter now! Route around the grumpy cats and find those sunny spots!',
        highlightColor: '#27AE60',
        emoji: '🐾',
      },
    ],
  },
  {
    chapterId: 16,
    title: 'Magic Linked Beds!',
    pages: [
      {
        chapter: 'Chapter 16 • Goldenrod Way',
        headline: 'Magic pollen links two distant beds! 🦴',
        dialogue: 'Wow! Fairy pollen has connected two far-apart flower beds! They\'re TWINSIES now — one puppy covers both beds!',
        highlightColor: '#FBC02D',
        emoji: '🦴',
      },
      {
        chapter: 'Chapter 16 • Goldenrod Way',
        headline: 'Twinsies share a puppy!',
        dialogue: 'See the 🦴 badge? Those beds share one pup. Place a puppy in either bed and both are happy! It\'s like magic!',
        highlightColor: '#FBC02D',
        emoji: '👯',
      },
      {
        chapter: 'Chapter 16 • Goldenrod Way',
        headline: 'Linked beds are friends!',
        dialogue: 'Linked beds make the puzzle trickier — the puppy that fills one also fills the other. You\'ve got this!',
        highlightColor: '#27AE60',
        emoji: '🌸',
      },
    ],
  },
  {
    chapterId: 21,
    title: 'Cats + Linked Beds!',
    pages: [
      {
        chapter: 'Chapter 21 • Highland Heather',
        headline: 'Two challenges at once! 😾🦴',
        dialogue: 'Now we have grumpy cats AND linked beds together! The cats block cells, and the linked beds share puppies across the map!',
        highlightColor: '#7E57C2',
        emoji: '😾',
      },
      {
        chapter: 'Chapter 21 • Highland Heather',
        headline: 'Plan around both!',
        dialogue: 'Watch the cat auras AND the linked bed connections. Sometimes a cat blocks one side of a linked pair — the pup must go on the other side!',
        highlightColor: '#7E57C2',
        emoji: '🧩',
      },
      {
        chapter: 'Chapter 21 • Highland Heather',
        headline: 'Expert sitter time!',
        dialogue: 'This is where puppy sitting gets serious! Combine everything you\'ve learned. You\'re becoming a true garden guardian!',
        highlightColor: '#27AE60',
        emoji: '🏅',
      },
    ],
  },
  {
    chapterId: 31,
    title: 'Twin Puppies Debut!',
    pages: [
      {
        chapter: 'Chapter 31 • Alpine Meadow',
        headline: 'TWO puppies per row now! 👯',
        dialogue: 'Amazing! The meadow has grown so big that every row, column, and color patch now needs TWO puppies! Double the fun!',
        highlightColor: '#3949AB',
        emoji: '👯',
      },
      {
        chapter: 'Chapter 31 • Alpine Meadow',
        headline: 'Twins still can\'t touch!',
        dialogue: 'Even with two pups per row, they still can\'t touch — not even diagonally! Look for the 🎀 bows on twin puppies to spot them easily!',
        highlightColor: '#3949AB',
        emoji: '🎀',
      },
      {
        chapter: 'Chapter 31 • Alpine Meadow',
        headline: 'Double the puzzle!',
        dialogue: '16 puppies on an 8×8 board! Use the paw quota badge (🐾×2) to track how many pups each row needs. You\'re ready for the big leagues!',
        highlightColor: '#27AE60',
        emoji: '🏆',
      },
    ],
  },
  {
    chapterId: 41,
    title: 'Twins + Cats!',
    pages: [
      {
        chapter: 'Chapter 41 • Grand Valley',
        headline: 'Twin pups meet grumpy cats! 😾👯',
        dialogue: 'The grand championship begins! Twin puppies on a 9×9 board — and a grumpy cat is here too! 18 puppies to place around the cat\'s aura!',
        highlightColor: '#1565C0',
        emoji: '😾',
      },
      {
        chapter: 'Chapter 41 • Grand Valley',
        headline: 'Expert terrain!',
        dialogue: 'Two pups per row, column, and patch — all while routing around the cat. The cat blocks 9 cells, so plan carefully where your twins go!',
        highlightColor: '#1565C0',
        emoji: '🧠',
      },
      {
        chapter: 'Chapter 41 • Grand Valley',
        headline: 'Championship sitter!',
        dialogue: 'You\'ve mastered cats and twins separately — now combine them! Only the best puppy sitters reach this far. You\'re amazing!',
        highlightColor: '#27AE60',
        emoji: '👑',
      },
    ],
  },
  {
    chapterId: 46,
    title: 'Grand Championship!',
    pages: [
      {
        chapter: 'Chapter 46 • Olympus Park',
        headline: 'Everything at once! 👯😾🦴',
        dialogue: 'The ultimate challenge! Twin puppies, grumpy cats, AND linked beds — all on a 10×10 board! 20 puppies to place perfectly!',
        highlightColor: '#283593',
        emoji: '🌟',
      },
      {
        chapter: 'Chapter 46 • Olympus Park',
        headline: 'The final frontier!',
        dialogue: 'Every mechanic you\'ve learned comes together here. Twin pups that can\'t touch, cats that block cells, and linked beds that share. Master this and you\'re a legend!',
        highlightColor: '#283593',
        emoji: '⚔️',
      },
      {
        chapter: 'Chapter 46 • Olympus Park',
        headline: 'You\'re a Garden Guardian!',
        dialogue: 'If you can solve these gardens, you can solve anything! Jenny believes in you — every puppy in the meadow is counting on you!',
        highlightColor: '#27AE60',
        emoji: '🏆',
      },
    ],
  },
  {
    chapterId: 51,
    title: 'The Encore Expedition!',
    pages: [
      {
        chapter: 'Chapter 51 • Rainbow Falls',
        headline: 'Beyond the sanctuary! 🌈',
        dialogue: 'You saved all 1,000 meadows! But past the rainbow there are 200 secret gardens — every one is 10×10 with 2 pups per row, column and patch.',
        highlightColor: '#00897B',
        emoji: '🌈',
      },
      {
        chapter: 'Chapter 51 • Rainbow Falls',
        headline: 'Three linked pairs! 🦴',
        dialogue: 'Rainbow mist links THREE pairs of beds here. Each 🦴 pair is one bed: together its two parts need 2 pups — 1 + 1, or 2 in one part.',
        highlightColor: '#00897B',
        emoji: '🦴',
      },
      {
        chapter: 'Chapter 51 • Rainbow Falls',
        headline: 'New surprises ahead!',
        dialogue: 'Each chapter brings a new twist. Tap ❓ any time to see the exact rules for the level you\'re on!',
        highlightColor: '#27AE60',
        emoji: '❓',
      },
    ],
  },
  {
    chapterId: 52,
    title: 'Hungry Beds Arrive!',
    pages: [
      {
        chapter: 'Chapter 52 • Hungry Hollow',
        headline: 'Some beds have their own appetite! 🍽️',
        dialogue: 'See the gold number badges? That patch needs exactly that many pups — not 2. The badge sits on the patch\'s top-left tile.',
        highlightColor: '#F4511E',
        emoji: '🍽️',
      },
      {
        chapter: 'Chapter 52 • Hungry Hollow',
        headline: 'The pond wants ZERO! ⛲',
        dialogue: 'A 0 bed is a pond — puppies can\'t swim! Paw-mark every pond tile first. The feast bed (4) has to fit 4 pups that still can\'t touch.',
        highlightColor: '#039BE5',
        emoji: '⛲',
      },
      {
        chapter: 'Chapter 52 • Hungry Hollow',
        headline: 'The numbers always balance!',
        dialogue: 'Rows and columns still need exactly 2 pups each — so the pups the pond refuses are the ones the feast bed eats. Count carefully!',
        highlightColor: '#27AE60',
        emoji: '⚖️',
      },
    ],
  },
  {
    chapterId: 56,
    title: 'Lighter Beds Join the Feast!',
    pages: [
      {
        chapter: 'Chapter 56 • Banquet Bluffs',
        headline: 'Badges of 1 and 3! 🎂',
        dialogue: 'Now some beds are a little hungrier (3) and some a little lighter (1). They always come in pairs — one bed hands a pup to the other.',
        highlightColor: '#5E35B1',
        emoji: '🎂',
      },
      {
        chapter: 'Chapter 56 • Banquet Bluffs',
        headline: 'Four labels at once!',
        dialogue: 'Some gardens have four number beds. Start with the most crowded: a 3 bed in a small patch has very few ways to fit.',
        highlightColor: '#5E35B1',
        emoji: '🧠',
      },
      {
        chapter: 'Chapter 56 • Banquet Bluffs',
        headline: 'Feast master!',
        dialogue: 'Unlabelled patches still need 2. Read every badge, count every row, and the garden will tell you where each pup belongs!',
        highlightColor: '#27AE60',
        emoji: '🏆',
      },
    ],
  },
];

export const getChapterStory = (chapterId: number): ChapterStory | null => {
  return CHAPTER_STORIES.find(s => s.chapterId === chapterId) || null;
};

/** Chapters that have intro stories (mechanic debuts). */
export const CHAPTERS_WITH_STORIES = new Set(CHAPTER_STORIES.map(s => s.chapterId));
