// Activities and sports commonly accessible in Singapore (ActiveSG facilities, park connectors,
// nature reserves, HDB estates, community clubs and commercial studios).
// Shared by the API (validation, simulated data) and the UI (pickers, labels).

export type Activity = {
  id: string;
  label: string;
  category: string;
  icon: string;
  // Simulated steps per active minute. 0 means steps are not a meaningful measure.
  stepsPerMinute: number;
};

export const ACTIVITIES: Activity[] = [
  { id: "any", label: "Any activity (mix it up)", category: "Anything goes", icon: "✨", stepsPerMinute: 80 },

  { id: "running", label: "Running / jogging", category: "Cardio & endurance", icon: "🏃", stepsPerMinute: 160 },
  { id: "walking", label: "Brisk walking", category: "Cardio & endurance", icon: "🚶", stepsPerMinute: 110 },
  { id: "cycling", label: "Cycling (park connectors)", category: "Cardio & endurance", icon: "🚴", stepsPerMinute: 10 },
  { id: "stairs", label: "Stair climbing (HDB blocks)", category: "Cardio & endurance", icon: "🪜", stepsPerMinute: 100 },
  { id: "rowing", label: "Rowing / indoor rowing", category: "Cardio & endurance", icon: "🚣", stepsPerMinute: 0 },

  { id: "gym", label: "Gym / strength training", category: "Gym & studio", icon: "🏋️", stepsPerMinute: 25 },
  { id: "hiit", label: "HIIT / circuit training", category: "Gym & studio", icon: "🔥", stepsPerMinute: 70 },
  { id: "spinning", label: "Spinning / indoor cycling", category: "Gym & studio", icon: "🚲", stepsPerMinute: 0 },
  { id: "dance", label: "Dance / Zumba", category: "Gym & studio", icon: "💃", stepsPerMinute: 90 },

  { id: "badminton", label: "Badminton", category: "Racket & court sports", icon: "🏸", stepsPerMinute: 60 },
  { id: "tennis", label: "Tennis", category: "Racket & court sports", icon: "🎾", stepsPerMinute: 55 },
  { id: "pickleball", label: "Pickleball", category: "Racket & court sports", icon: "🏓", stepsPerMinute: 50 },
  { id: "table-tennis", label: "Table tennis", category: "Racket & court sports", icon: "🏓", stepsPerMinute: 30 },
  { id: "squash", label: "Squash", category: "Racket & court sports", icon: "🎾", stepsPerMinute: 65 },

  { id: "basketball", label: "Basketball", category: "Team sports", icon: "🏀", stepsPerMinute: 80 },
  { id: "football", label: "Football / futsal", category: "Team sports", icon: "⚽", stepsPerMinute: 110 },
  { id: "volleyball", label: "Volleyball / beach volleyball", category: "Team sports", icon: "🏐", stepsPerMinute: 45 },
  { id: "netball", label: "Netball", category: "Team sports", icon: "🥅", stepsPerMinute: 70 },
  { id: "floorball", label: "Floorball", category: "Team sports", icon: "🏑", stepsPerMinute: 85 },
  { id: "rugby", label: "Touch rugby / rugby", category: "Team sports", icon: "🏉", stepsPerMinute: 95 },
  { id: "ultimate", label: "Ultimate frisbee", category: "Team sports", icon: "🥏", stepsPerMinute: 100 },
  { id: "cricket", label: "Cricket", category: "Team sports", icon: "🏏", stepsPerMinute: 40 },

  { id: "swimming", label: "Swimming (ActiveSG pools)", category: "Water sports", icon: "🏊", stepsPerMinute: 0 },
  { id: "water-polo", label: "Water polo", category: "Water sports", icon: "🤽", stepsPerMinute: 0 },
  { id: "dragon-boat", label: "Dragon boat", category: "Water sports", icon: "🐉", stepsPerMinute: 0 },
  { id: "kayaking", label: "Kayaking / paddling", category: "Water sports", icon: "🛶", stepsPerMinute: 0 },
  { id: "sup", label: "Stand-up paddle (SUP)", category: "Water sports", icon: "🏄", stepsPerMinute: 0 },

  { id: "hiking", label: "Hiking / nature trails", category: "Outdoors & adventure", icon: "🥾", stepsPerMinute: 95 },
  { id: "climbing", label: "Climbing / bouldering", category: "Outdoors & adventure", icon: "🧗", stepsPerMinute: 20 },
  { id: "skating", label: "Inline skating / skateboarding", category: "Outdoors & adventure", icon: "🛼", stepsPerMinute: 15 },
  { id: "golf", label: "Golf (driving range / course)", category: "Outdoors & adventure", icon: "⛳", stepsPerMinute: 60 },

  { id: "yoga", label: "Yoga", category: "Mind-body & martial arts", icon: "🧘", stepsPerMinute: 5 },
  { id: "pilates", label: "Pilates", category: "Mind-body & martial arts", icon: "🤸", stepsPerMinute: 5 },
  { id: "tai-chi", label: "Tai chi / qigong", category: "Mind-body & martial arts", icon: "☯️", stepsPerMinute: 15 },
  { id: "martial-arts", label: "Martial arts (taekwondo, judo, silat)", category: "Mind-body & martial arts", icon: "🥋", stepsPerMinute: 45 },
  { id: "boxing", label: "Boxing / Muay Thai", category: "Mind-body & martial arts", icon: "🥊", stepsPerMinute: 40 },
];

export const DEFAULT_ACTIVITY = "any";
export const ACTIVITY_IDS = ACTIVITIES.map((a) => a.id) as [string, ...string[]];

export const getActivity = (id: string | null | undefined): Activity =>
  ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[0]!;

export const ACTIVITY_CATEGORIES = [...new Set(ACTIVITIES.map((a) => a.category))];
