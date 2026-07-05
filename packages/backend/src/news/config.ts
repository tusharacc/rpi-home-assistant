export const TAVILY_TOPICS = [
  'Indian economy and markets news',
  'global technology industry news',
  'AI policy and regulation news',
  'semiconductor and hardware industry news',
  'startup funding news',
]

export const RSS_FEEDS: { source: string; url: string; category: 'general' }[] = [
  {
    source: 'google-news:india-business',
    url: 'https://news.google.com/rss/search?q=india+business&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'general',
  },
  {
    source: 'google-news:world-tech',
    url: 'https://news.google.com/rss/search?q=technology+industry&hl=en-US&gl=US&ceid=US:en',
    category: 'general',
  },
  {
    source: 'google-news:ai-policy',
    url: 'https://news.google.com/rss/search?q=ai+policy+regulation&hl=en-US&gl=US&ceid=US:en',
    category: 'general',
  },
]

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
