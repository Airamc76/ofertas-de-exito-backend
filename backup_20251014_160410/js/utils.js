// Client ID utility
export function getClientId() {
  let id = localStorage.getItem('clientId');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    localStorage.setItem('clientId', id);
  }
  return id;
}
