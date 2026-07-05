export function postArticleAction(id: number, action: 'save' | 'ignore' | 'read'): void {
  fetch(`/api/news/${id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }).catch(() => {})
}
