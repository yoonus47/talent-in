/**
 * Categorized hobby taxonomy — replaces the old flat `INTEREST_OPTIONS`.
 * Stored the same way as before (`profiles.interests text[]`, no schema
 * change needed): this is just a much richer, better-organized set of
 * values for that same column, used for profile display, onboarding,
 * and interest-based matching (Discover -> People, suggested profiles).
 */

export type HobbyCategory = {
  name: string;
  hobbies: string[];
};

export const HOBBY_CATEGORIES: HobbyCategory[] = [
  {
    name: "Outdoor & Nature",
    hobbies: [
      "Fishing",
      "Mountain Climbing",
      "Gardening",
      "Camping",
      "Orienteering",
      "Hiking",
      "Birdwatching",
      "Kayaking",
      "Surfing",
      "Scuba Diving",
    ],
  },
  {
    name: "Sports & Fitness",
    hobbies: [
      "Cricket",
      "Football",
      "Basketball",
      "Badminton",
      "Table Tennis",
      "Volleyball",
      "Tennis",
      "Athletics & Running",
      "Swimming",
      "Cycling",
      "Yoga",
      "Gym & Weight Training",
      "Martial Arts",
      "Skateboarding",
    ],
  },
  {
    name: "Music & Performance",
    hobbies: [
      "Band/Orchestra",
      "Songwriting",
      "Singing",
      "Guitar",
      "Piano",
      "DJing",
      "Music Production",
      "Vinyl Collecting",
      "Music History",
      "Concerts",
      "Acting",
      "Theater",
      "Dance",
      "Stand-Up Comedy",
      "Movie Analysis",
      "Improv",
      "Storytelling",
      "Voice Acting",
      "Puppetry",
      "Film Editing",
      "Magic Tricks",
    ],
  },
  {
    name: "Arts & Crafts",
    hobbies: [
      "Painting & Drawing",
      "Sculpture",
      "Photography",
      "Videography",
      "Design",
      "Pottery",
      "Calligraphy",
      "Origami",
      "Animation",
      "Mixed Media Art",
      "Graphic Design",
      "Woodworking",
      "Knitting",
      "Sewing",
      "Jewelry Making",
      "Scrapbooking",
      "Candle Making",
      "Soap Making",
      "Furniture Restoration",
      "Model Building",
    ],
  },
  {
    name: "Writing",
    hobbies: [
      "Blogging",
      "Journaling",
      "Short Stories",
      "Poetry",
      "Journalism",
      "Screenwriting",
      "Playwriting",
      "Editing",
      "Copywriting",
      "Book Reviewing",
    ],
  },
  {
    name: "Volunteering & Community",
    hobbies: [
      "Charity & Fundraising",
      "Community Events",
      "Environmental Work",
      "Coaching & Mentoring",
      "Tutoring",
      "Animal Shelter Work",
      "Homeless Outreach",
      "Disaster Relief",
      "Advocacy",
      "Teaching Workshops",
    ],
  },
  {
    name: "Technology & Digital",
    hobbies: [
      "Coding",
      "Artificial Intelligence",
      "Machine Learning",
      "AI Chatbots",
      "Prompt Engineering",
      "AI Automation",
      "Game Development",
      "Robotics",
      "Website Design",
      "Mobile App Development",
      "Cryptocurrency",
      "Cybersecurity",
      "3D Printing",
      "Stock Market",
    ],
  },
  {
    name: "Internet & Online",
    hobbies: [
      "E-Sports",
      "Vlogging",
      "Social Media",
      "Podcasting",
      "Live Streaming",
      "Online Forums",
      "Virtual Worlds",
      "Online Coaching",
      "Influencer Marketing",
    ],
  },
  {
    name: "Intellectual",
    hobbies: [
      "Language Learning",
      "Chess",
      "Trivia",
      "Debate",
      "Philosophy",
      "Public Speaking",
      "Genealogy",
      "History Reenactment",
      "Astronomy",
      "Reading Novels",
    ],
  },
  {
    name: "Food & Drink",
    hobbies: [
      "Cooking",
      "Baking",
      "Tea Tasting",
      "Coffee Brewing",
      "Mocktail Making",
      "Food Blogging",
      "Global Cuisine",
      "Meal Prepping",
      "Cheesemaking",
      "Pickling",
      "Kombucha Brewing",
    ],
  },
  {
    name: "Miscellaneous",
    hobbies: ["Mindfulness", "Meditation", "Antique Collecting", "Traveling", "Urban Exploration"],
  },
];

export const ALL_HOBBIES: string[] = HOBBY_CATEGORIES.flatMap((c) => c.hobbies);

const HOBBY_CATEGORY_BY_NAME = new Map<string, string>(
  HOBBY_CATEGORIES.flatMap((c) => c.hobbies.map((h) => [h, c.name] as const)),
);

export function categoryForHobby(hobby: string): string | undefined {
  return HOBBY_CATEGORY_BY_NAME.get(hobby);
}

export const MAX_HOBBIES = 15;
