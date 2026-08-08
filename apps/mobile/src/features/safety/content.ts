export interface SafetyTopic {
  key: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
}

export const SAFETY_TOPICS: SafetyTopic[] = [
  {
    key: "meetup",
    title: "Meeting Up Safely",
    summary: "Turning an online match into an actual co-op session, the smart way.",
    sections: [
      {
        heading: "Screen before you meet",
        body:
          "A voice or video chat, or just a session together in-game first, tells you a lot more than " +
          "text ever will. If someone will only ever type and won't hop on a call or play a round with you, " +
          "that's worth noticing.",
      },
      {
        heading: "Meet in public first",
        body:
          "If you're meeting up in person (a LAN event, a tournament, a meetup), pick a public place for the " +
          "first time and let a friend know where you'll be and when you expect to be back.",
      },
      {
        heading: "Never share financial or personal details early",
        body:
          "Don't share your home address, workplace, or financial details with someone you've only just " +
          "matched with. It's fine to keep that private for as long as you want.",
      },
      {
        heading: "Trust your gut",
        body:
          "If something feels off, it's okay to end the conversation, skip the meetup, or leave a session " +
          "early. You don't owe anyone an explanation.",
      },
    ],
  },
  {
    key: "scams",
    title: "Spotting Scams",
    summary: "Common patterns scammers use on gaming platforms and everywhere else.",
    sections: [
      {
        heading: "Never send money or gift cards",
        body:
          "No legitimate reason exists for a match to ask you for money, gift cards, or crypto, whether for a " +
          "\"tournament entry fee,\" a \"rare item trade,\" or anything else. If money comes up, report it.",
      },
      {
        heading: "Watch for urgency",
        body:
          "Scammers create time pressure: a deal that expires today, a \"friend\" who suddenly needs help. " +
          "Slow down. Real people are fine with you taking your time.",
      },
      {
        heading: "Be wary of external trades and links",
        body:
          "Be cautious about moving straight to third-party trading sites or unfamiliar links to \"claim\" " +
          "in-game items. These are common vectors for account theft.",
      },
      {
        heading: "Report, don't engage",
        body: "If you spot a scam attempt, report the user rather than trying to call them out yourself.",
      },
    ],
  },
  {
    key: "guidelines",
    title: "Community Guidelines",
    summary: "What we expect from everyone using DuoQueue.",
    sections: [
      {
        heading: "Be who you say you are",
        body:
          "One account per person, real photos of yourself, and an honest age. Impersonation or misleading " +
          "photos get accounts removed.",
      },
      {
        heading: "No harassment, hate speech, or threats",
        body:
          "Disagreements happen, but harassment, slurs, threats, and hate speech toward anyone are never " +
          "acceptable here, in-app or in a shared game session.",
      },
      {
        heading: "No exploiting other players",
        body:
          "Don't use DuoQueue to scam, cheat, or extract real-world value from other users under false " +
          "pretenses.",
      },
      {
        heading: "Respect a no",
        body:
          "If someone unmatches, blocks, or asks you to stop, respect it. Don't look for them elsewhere or " +
          "create a new account to get around a block.",
      },
      {
        heading: "Report what you see",
        body:
          "If someone breaks these guidelines, report them. It helps us keep the community safe for " +
          "everyone, not just you.",
      },
    ],
  },
  {
    key: "reporting",
    title: "Reporting & Blocking",
    summary: "How it works, what happens after, and why it matters.",
    sections: [
      {
        heading: "How to report someone",
        body:
          "From their profile in your deck, or from a chat, tap the \"...\" menu, choose Report, pick a " +
          "reason, and submit. It only takes a few seconds.",
      },
      {
        heading: "It's confidential",
        body:
          "The person you report is never told who reported them. Blocking someone also removes any match " +
          "between you immediately.",
      },
      {
        heading: "What happens to a report",
        body:
          "Our team reviews every report and takes action where warranted: anything from a warning to a " +
          "permanent ban, depending on severity.",
      },
      {
        heading: "Reporting is for real violations",
        body:
          "Reporting is meant for genuine safety or guideline violations, not for people you've simply lost " +
          "interest in (use Unmatch for that instead). Deliberately false reports can result in action against " +
          "your own account.",
      },
    ],
  },
  {
    key: "crisis",
    title: "Crisis Support",
    summary: "If you or someone else needs help right now.",
    sections: [
      {
        heading: "If you're in immediate danger",
        body: "Contact your local emergency services right away. Don't wait.",
      },
      {
        heading: "US: 988 Suicide & Crisis Lifeline",
        body:
          "If you or someone you know is struggling emotionally or having thoughts of suicide, call or text " +
          "988 (US) for free, confidential support, 24/7.",
      },
      {
        heading: "Outside the US",
        body:
          "The International Association for Suicide Prevention (iasp.info) maintains a directory of crisis " +
          "centers by country.",
      },
      {
        heading: "Concerned about someone else",
        body:
          "If you're worried about another user's safety based on something they've said, please report it. " +
          "Our team reviews these directly.",
      },
    ],
  },
];
