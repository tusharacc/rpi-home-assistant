export const TAVILY_TOPICS = [
  'Indian economy and markets news',
  'global technology industry news',
  'AI policy and regulation news',
  'semiconductor and hardware industry news',
  'startup funding news',
]

// Google News RSS <link> values are unresolvable JS-redirect wrapper URLs
// (news.google.com serves a 200 OK single-page app that client-side-navigates
// to the real article — no HTTP redirect exists to follow), which breaks both
// paywall detection and "Open Original". Tavily covers the same topics with
// real, direct publisher URLs instead. Left empty rather than removed — a
// real (non-Google) RSS feed can be added here later.
export const RSS_FEEDS: { source: string; url: string; category: 'general' }[] = []

export const REDDIT_COMMUNITIES = ['MachineLearning', 'LocalLLaMA', 'devops', 'programming']

export const GITHUB_TOPICS = [
  'llm',
  'rag',
  'agentic-ai',
  'ai-agents',
  'devops',
  'observability',
  'sre',
]

export const HN_MIN_POINTS = 50
