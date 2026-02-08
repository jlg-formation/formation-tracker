# 04 - Gmail API

## Vue d'ensemble

L'application utilise l'API Gmail pour récupérer les emails d'ORSYS. L'authentification se fait via **OAuth 2.0** avec popup Google.

---

## Configuration Google Cloud Console

### 1. Créer un projet

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet : `orsys-training-tracker`
3. Activer l'API Gmail : APIs & Services → Enable APIs → Gmail API

### 2. Configurer OAuth 2.0

1. APIs & Services → Credentials → Create Credentials → OAuth client ID
2. Type d'application : **Web application**
3. Nom : `Formation Tracker`
4. Origines JavaScript autorisées :
   - `http://localhost:5173` (dev)
   - `https://jlg-formation.github.io` (prod)
5. URIs de redirection autorisées :
   - `http://localhost:5173` (dev)
   - `https://jlg-formation.github.io/formation-tracker/` (prod)

### 3. Écran de consentement OAuth

1. APIs & Services → OAuth consent screen
2. User Type : **External**
3. Informations de l'application :
   - Nom : ORSYS Training Tracker
   - Email support : votre email
   - Logo : optionnel
4. Scopes :
   - `https://www.googleapis.com/auth/gmail.readonly`
5. Utilisateurs test : ajouter votre email (mode développement)

### 4. Récupérer les credentials

- **Client ID** : `xxxx.apps.googleusercontent.com`
- **Client Secret** : Non nécessaire pour SPA (implicit flow ou PKCE)

---

## Implémentation OAuth 2.0

### Configuration

```typescript
// src/services/gmail/config.ts

// Client ID par défaut (jlg-formation), peut être remplacé par l'utilisateur
export const DEFAULT_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function getGmailConfig() {
  // Priorité : localStorage > variable d'env > défaut
  const clientId =
    localStorage.getItem("google_client_id") || DEFAULT_GOOGLE_CLIENT_ID;

  return {
    clientId,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    discoveryDocs: [
      "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"
    ]
  };
}
```

### Initialisation de l'API Google

```typescript
// src/services/gmail/auth.ts

import { GMAIL_CONFIG } from "./config";

let tokenClient: google.accounts.oauth2.TokenClient;
let accessToken: string | null = null;

export async function initGoogleAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Charger le script Google Identity Services
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GMAIL_CONFIG.clientId,
        scope: GMAIL_CONFIG.scopes.join(" "),
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            accessToken = response.access_token;
            // Stocker le token et son expiration
            saveToken(accessToken, response.expires_in);
            resolve();
          }
        }
      });
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function requestAccessToken(): void {
  tokenClient.requestAccessToken({ prompt: "consent" });
}

export function getAccessToken(): string | null {
  return accessToken;
}

function saveToken(token: string, expiresIn: number): void {
  const expiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  localStorage.setItem("gmail_token", token);
  localStorage.setItem("gmail_token_expiry", expiry);
}

export function loadStoredToken(): boolean {
  const token = localStorage.getItem("gmail_token");
  const expiry = localStorage.getItem("gmail_token_expiry");

  if (token && expiry && new Date(expiry) > new Date()) {
    accessToken = token;
    return true;
  }
  return false;
}

export function logout(): void {
  accessToken = null;
  localStorage.removeItem("gmail_token");
  localStorage.removeItem("gmail_token_expiry");
  google.accounts.oauth2.revoke(accessToken!);
}
```

---

## Récupération des emails

### Query de recherche

```typescript
// Tous les emails d'ORSYS depuis 2014
const GMAIL_QUERY = "from:orsys.fr after:2014/01/01";
```

### Listing des messages

```typescript
// src/services/gmail/api.ts

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailListResponse {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export async function listMessages(
  pageToken?: string
): Promise<GmailListResponse> {
  const token = getAccessToken();
  if (!token) throw new Error("Non authentifié");

  const params = new URLSearchParams({
    q: GMAIL_QUERY,
    maxResults: "100"
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status}`);
  }

  return response.json();
}
```

### Récupération d'un message complet

```typescript
interface GmailFullMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  internalDate: string;
}

export async function getMessage(messageId: string): Promise<GmailFullMessage> {
  const token = getAccessToken();
  if (!token) throw new Error("Non authentifié");

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status}`);
  }

  return response.json();
}
```

### Extraction du corps de l'email

```typescript
export function extractEmailBody(message: GmailFullMessage): {
  text: string;
  html?: string;
} {
  let text = "";
  let html: string | undefined;

  function decodeBase64(data: string): string {
    // Gmail utilise base64url
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  }

  function extractParts(parts: GmailFullMessage["payload"]["parts"]) {
    if (!parts) return;

    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text = decodeBase64(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64(part.body.data);
      }
    }
  }

  // Corps simple
  if (message.payload.body?.data) {
    text = decodeBase64(message.payload.body.data);
  }

  // Corps multipart
  if (message.payload.parts) {
    extractParts(message.payload.parts);
  }

  return { text, html };
}

export function extractEmailHeaders(message: GmailFullMessage): {
  from: string;
  subject: string;
  date: string;
} {
  const headers = message.payload.headers;

  const getHeader = (name: string): string => {
    return (
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
      ""
    );
  };

  return {
    from: getHeader("From"),
    subject: getHeader("Subject"),
    date: new Date(parseInt(message.internalDate)).toISOString()
  };
}
```

---

## Cache IndexedDB

### Structure de la base

```typescript
// src/stores/db.ts

import Dexie, { Table } from "dexie";
import { EmailRaw, Formation, GeocacheEntry, AppSettings } from "../types";

export class OrsysDatabase extends Dexie {
  emails!: Table<EmailRaw, string>;
  formations!: Table<Formation, string>;
  geocache!: Table<GeocacheEntry, string>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super("orsys-training-tracker");

    this.version(1).stores({
      emails: "id, threadId, date, processed, type, formationId",
      formations: "id, codeEtendu, dateDebut, statut, typeSession, updatedAt",
      geocache: "adresse, provider, cachedAt",
      settings: "++id"
    });
  }
}

export const db = new OrsysDatabase();
```

### Vérification du cache avant appel API

```typescript
export async function fetchNewEmails(
  onProgress?: (current: number, total: number) => void
): Promise<EmailRaw[]> {
  const newEmails: EmailRaw[] = [];

  // Récupérer tous les IDs déjà en cache
  const cachedIds = new Set(await db.emails.toCollection().primaryKeys());

  let pageToken: string | undefined;
  let totalFetched = 0;

  do {
    const response = await listMessages(pageToken);

    for (const msg of response.messages || []) {
      if (!cachedIds.has(msg.id)) {
        // Nouveau message, récupérer le contenu complet
        const fullMessage = await getMessage(msg.id);
        const { text, html } = extractEmailBody(fullMessage);
        const headers = extractEmailHeaders(fullMessage);

        const emailRaw: EmailRaw = {
          id: msg.id,
          threadId: msg.threadId,
          from: headers.from,
          subject: headers.subject,
          date: headers.date,
          body: text,
          bodyHtml: html,
          processed: false
        };

        newEmails.push(emailRaw);

        // Sauvegarder immédiatement en cache
        await db.emails.put(emailRaw);
      }

      totalFetched++;
    }

    onProgress?.(totalFetched, response.resultSizeEstimate);
    pageToken = response.nextPageToken;

    // Rate limiting : attendre 100ms entre les pages
    if (pageToken) {
      await new Promise((r) => setTimeout(r, 100));
    }
  } while (pageToken);

  return newEmails;
}
```

---

## Quotas et limites

| Limite                               | Valeur                           |
| ------------------------------------ | -------------------------------- |
| Requêtes par jour                    | 1 000 000 000 (rarement atteint) |
| Requêtes par utilisateur par seconde | 250                              |
| Messages par requête list            | 100 max                          |
| Taille max réponse                   | 25 MB                            |

### Bonnes pratiques

1. **Pagination** : Utiliser `maxResults=100` et `pageToken`
2. **Rate limiting** : 100ms entre les requêtes
3. **Cache agressif** : Ne jamais re-télécharger un email déjà en cache
4. **Format minimal** : Utiliser `format=full` seulement quand nécessaire

---

## Variables d'environnement

```env
# .env.local
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

⚠️ **Ne jamais commiter `.env.local`** - Ajouter au `.gitignore`
