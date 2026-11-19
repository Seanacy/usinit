// A set of looks so a list of boxes doesn't all look the same.
// Used by the Ambassador "Your links" boxes and the sign-up "what type of account" cards.
// box = the box, sub = the small gray-ish text, btn = the button inside it.
export const BOX_STYLES = [
  { box: 'border-2 border-orange bg-white text-ink dark:bg-neutral-900 dark:text-white', sub: 'text-neutral-600 dark:text-neutral-300', btn: 'border-2 border-orange text-ink dark:text-white' },
  { box: 'border-2 border-orange bg-orange text-ink', sub: 'text-ink/80', btn: 'bg-ink text-white' },
  { box: 'border-2 border-ink bg-ink text-white dark:border-white', sub: 'text-neutral-300', btn: 'bg-white text-ink' },
  { box: 'border-4 border-ink bg-white text-ink dark:bg-neutral-900 dark:border-white dark:text-white', sub: 'text-neutral-600 dark:text-neutral-300', btn: 'border-2 border-ink text-ink dark:border-white dark:text-white' },
  { box: 'border-2 border-orange bg-orange/15 text-ink dark:text-white', sub: 'text-neutral-700 dark:text-neutral-300', btn: 'bg-orange text-ink' },
  { box: 'border-2 border-orange bg-ink text-orange', sub: 'text-neutral-300', btn: 'bg-orange text-ink' },
]
export const boxStyle = (i) => BOX_STYLES[i % BOX_STYLES.length]
