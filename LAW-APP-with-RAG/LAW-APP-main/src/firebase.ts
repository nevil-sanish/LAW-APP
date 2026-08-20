import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged as _onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  limit,
  Timestamp,
  onSnapshot,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import type { Message, ChatSession, VerifiedLaw } from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence so Firestore works even with spotty connectivity
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence: Multiple tabs open, persistence disabled.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence: Browser does not support all required features.');
  }
});

const googleProvider = new GoogleAuthProvider();

// Handle redirect result on page load
getRedirectResult(auth).catch((error) => {
  console.error('Redirect result error:', error);
});

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Popup sign-in failed, trying redirect:', err.code);

    if (
      err.code === 'auth/popup-blocked' ||
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request' ||
      err.message?.includes('Cross-Origin-Opener-Policy')
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

export async function signOutUser() {
  await signOut(auth);
}

export function onAuthStateChanged(callback: (user: User | null) => void) {
  return _onAuthStateChanged(auth, callback);
}

// ============ Helpers ============

/**
 * Safely convert a Firestore Timestamp or any date-like value to a JS Date.
 */
function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof val === 'number') return new Date(val);
  return new Date();
}

/**
 * Log Firestore errors with a user-friendly prefix.
 */
function logFirestoreError(operation: string, error: unknown): void {
  const err = error as { code?: string; message?: string };
  const code = err.code || 'unknown';
  const message = err.message || 'Unknown error';

  if (code === 'permission-denied' || code === 'PERMISSION_DENIED') {
    console.error(
      `[Firestore] ${operation} — PERMISSION DENIED. ` +
        `Please update your Firestore security rules in the Firebase Console. ` +
        `Go to: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules ` +
        `and ensure authenticated users have read/write access.`
    );
  } else if (code === 'unavailable') {
    console.error(`[Firestore] ${operation} — Service unavailable. Check your internet connection.`);
  } else if (code === 'failed-precondition') {
    console.error(
      `[Firestore] ${operation} — Query requires an index. ` +
        `Check the browser console for a link to create the index in Firebase Console.`
    );
  } else {
    console.error(`[Firestore] ${operation} — [${code}] ${message}`);
  }
}

// ============ Firestore Document Operations ============

export interface FirestoreDoc {
  id: string;
  title: string;
  content: string;
  sections: string[];
  type: 'file' | 'text';
  createdAt: unknown;
}

export async function saveDocument(
  uid: string,
  doc_data: { title: string; content: string; sections: string[]; type: 'file' | 'text' }
) {
  try {
    const colRef = collection(db, 'users', uid, 'documents');
    const docRef = await addDoc(colRef, {
      ...doc_data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    logFirestoreError('saveDocument', error);
    throw error;
  }
}

export async function getDocuments(uid: string): Promise<FirestoreDoc[]> {
  try {
    const colRef = collection(db, 'users', uid, 'documents');
    // Simple query without orderBy to avoid index requirements
    const snapshot = await getDocs(colRef);
    const docs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as FirestoreDoc[];
    // Sort client-side
    docs.sort((a, b) => {
      const aDate = toDate(a.createdAt);
      const bDate = toDate(b.createdAt);
      return bDate.getTime() - aDate.getTime();
    });
    return docs;
  } catch (error) {
    logFirestoreError('getDocuments', error);
    return []; // Return empty array instead of crashing
  }
}

export async function deleteDocument(uid: string, docId: string) {
  try {
    const docRef = doc(db, 'users', uid, 'documents', docId);
    await deleteDoc(docRef);
  } catch (error) {
    logFirestoreError('deleteDocument', error);
    throw error;
  }
}

// ============ Chat History Operations ============

interface FirestoreChatSession {
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: string[];
    timestamp: string;
  }>;
  createdAt: unknown;
  updatedAt: unknown;
}

export async function saveChatSession(
  uid: string,
  session: ChatSession
): Promise<string> {
  try {
    const docRef = doc(db, 'users', uid, 'chats', session.id);
    const data: Record<string, unknown> = {
      title: session.title,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
      })),
      updatedAt: serverTimestamp(),
      // Always include createdAt — on first write it sets the value,
      // on subsequent writes merge:true preserves the existing field only
      // if we DON'T include it. So we conditionally add it below.
    };
    // Include createdAt only for brand new sessions
    const existing = await getDoc(docRef);
    if (!existing.exists()) {
      data.createdAt = serverTimestamp();
    }
    await setDoc(docRef, data, { merge: true });
    return session.id;
  } catch (error) {
    logFirestoreError('saveChatSession', error);
    throw error;
  }
}

export async function getChatSessions(uid: string): Promise<ChatSession[]> {
  try {
    const colRef = collection(db, 'users', uid, 'chats');
    const snapshot = await getDocs(colRef);
    const sessions = snapshot.docs.map((d) => {
      const data = d.data() as FirestoreChatSession;
      return {
        id: d.id,
        title: data.title || 'Untitled Chat',
        messages: (data.messages || []).map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      };
    });
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return sessions;
  } catch (error) {
    logFirestoreError('getChatSessions', error);
    return [];
  }
}

/**
 * Real-time subscription to chat sessions so UI stays in sync.
 */
export function subscribeToChatSessions(
  uid: string,
  callback: (sessions: ChatSession[]) => void,
  onError?: (error: Error) => void,
) {
  const colRef = collection(db, 'users', uid, 'chats');

  return onSnapshot(
    colRef,
    (snapshot) => {
      const sessions = snapshot.docs.map((d) => {
        const data = d.data() as FirestoreChatSession;
        return {
          id: d.id,
          title: data.title || 'Untitled Chat',
          messages: (data.messages || []).map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });
      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      callback(sessions);
    },
    (error) => {
      logFirestoreError('subscribeToChatSessions', error);
      if (onError) onError(error);
      callback([]);
    },
  );
}

export async function deleteChatSession(uid: string, chatId: string) {
  try {
    const docRef = doc(db, 'users', uid, 'chats', chatId);
    await deleteDoc(docRef);
  } catch (error) {
    logFirestoreError('deleteChatSession', error);
    throw error;
  }
}

/**
 * Delete all chat sessions for a user.
 */
export async function deleteAllChatSessions(uid: string): Promise<void> {
  try {
    const colRef = collection(db, 'users', uid, 'chats');
    const snapshot = await getDocs(colRef);
    const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    logFirestoreError('deleteAllChatSessions', error);
    throw error;
  }
}

// ============ Law Verification & Approval Operations ============

interface FirestoreLaw {
  title: string;
  content: string;
  category: string;
  sections: string[];
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedBy: string;
  uploaderName: string;
  uploaderEmail: string;
  verifiedAt: unknown;
  approvedAt: unknown;
  approvedBy: string | null;
  createdAt: unknown;
  type: 'file' | 'text';
  pdfUrl?: string;
  originalFileName?: string;
}

function firestoreLawToVerifiedLaw(id: string, data: FirestoreLaw): VerifiedLaw {
  return {
    id,
    title: data.title || 'Untitled Law',
    content: data.content || '',
    category: data.category || 'constitutional',
    sections: data.sections || [],
    summary: data.summary || '',
    status: data.status || 'pending',
    uploadedBy: data.uploadedBy || '',
    uploaderName: data.uploaderName || 'Unknown',
    uploaderEmail: data.uploaderEmail || '',
    verifiedAt: data.verifiedAt ? toDate(data.verifiedAt) : null,
    approvedAt: data.approvedAt ? toDate(data.approvedAt) : null,
    approvedBy: data.approvedBy || null,
    createdAt: toDate(data.createdAt),
    type: data.type || 'text',
    pdfUrl: data.pdfUrl || undefined,
    originalFileName: data.originalFileName || undefined,
  };
}

/**
 * Upload a PDF file to Firebase Storage and return its download URL.
 */
export async function uploadPdfToStorage(
  uid: string,
  file: File,
): Promise<string> {
  try {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(storage, `law-pdfs/${uid}/${timestamp}_${safeName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    logFirestoreError('uploadPdfToStorage', error);
    throw error;
  }
}

/**
 * Submit a law for verification and admin approval.
 * Stored in the global `laws` collection.
 */
export async function submitLawForVerification(
  uid: string,
  uploaderName: string,
  uploaderEmail: string,
  lawData: {
    title: string;
    content: string;
    category: string;
    sections: string[];
    summary: string;
    type: 'file' | 'text';
    pdfUrl?: string;
    originalFileName?: string;
  }
): Promise<string> {
  try {
    const colRef = collection(db, 'laws');
    const docRef = await addDoc(colRef, {
      ...lawData,
      status: 'pending',
      uploadedBy: uid,
      uploaderName,
      uploaderEmail,
      verifiedAt: serverTimestamp(),
      approvedAt: null,
      approvedBy: null,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    logFirestoreError('submitLawForVerification', error);
    throw error;
  }
}

/**
 * Get all pending laws (for admin review)
 */
export async function getPendingLaws(): Promise<VerifiedLaw[]> {
  const allLaws = await getAllLaws();
  return allLaws.filter((law) => law.status === 'pending');
}

/**
 * Get all laws (for admin — all statuses)
 */
export async function getAllLaws(): Promise<VerifiedLaw[]> {
  try {
    const colRef = collection(db, 'laws');
    // Simple query without orderBy to avoid index requirements
    const snapshot = await getDocs(colRef);
    const laws = snapshot.docs.map((d) =>
      firestoreLawToVerifiedLaw(d.id, d.data() as FirestoreLaw)
    );
    // Sort client-side by createdAt descending
    laws.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return laws;
  } catch (error) {
    logFirestoreError('getAllLaws', error);
    return []; // Return empty array instead of crashing
  }
}

export function subscribeToAllLaws(
  callback: (laws: VerifiedLaw[]) => void,
  onError?: (error: Error) => void,
) {
  const colRef = collection(db, 'laws');
  // Simple snapshot without orderBy to avoid index requirements

  return onSnapshot(
    colRef,
    (snapshot) => {
      const laws = snapshot.docs.map((d) =>
        firestoreLawToVerifiedLaw(d.id, d.data() as FirestoreLaw)
      );
      // Sort client-side by createdAt descending
      laws.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(laws);
    },
    (error) => {
      logFirestoreError('subscribeToAllLaws', error);
      if (onError) onError(error);
      // Return empty array as fallback so the UI doesn't break
      callback([]);
    },
  );
}

/**
 * Approve a law (admin action)
 */
export async function approveLaw(lawId: string, adminUid: string): Promise<void> {
  try {
    const docRef = doc(db, 'laws', lawId);
    await updateDoc(docRef, {
      status: 'approved',
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
    });
  } catch (error) {
    logFirestoreError('approveLaw', error);
    throw error;
  }
}

/**
 * Reject a law (admin action)
 */
export async function rejectLaw(lawId: string, adminUid: string): Promise<void> {
  try {
    const docRef = doc(db, 'laws', lawId);
    await updateDoc(docRef, {
      status: 'rejected',
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
    });
  } catch (error) {
    logFirestoreError('rejectLaw', error);
    throw error;
  }
}

/**
 * Get all approved laws (for Study section — global)
 */
export async function getApprovedLaws(): Promise<VerifiedLaw[]> {
  const allLaws = await getAllLaws();
  return allLaws.filter((law) => law.status === 'approved');
}

/**
 * Get approved laws by category (for Study section filtering)
 */
export async function getApprovedLawsByCategory(category: string): Promise<VerifiedLaw[]> {
  const approvedLaws = await getApprovedLaws();
  return approvedLaws.filter((law) => law.category === category);
}

/**
 * Get laws uploaded by a specific user
 */
export async function getUserSubmittedLaws(uid: string): Promise<VerifiedLaw[]> {
  try {
    const colRef = collection(db, 'laws');
    const q = query(colRef, where('uploadedBy', '==', uid));
    const snapshot = await getDocs(q);
    const laws = snapshot.docs.map((d) =>
      firestoreLawToVerifiedLaw(d.id, d.data() as FirestoreLaw)
    );
    // Sort client-side
    laws.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return laws;
  } catch (error) {
    logFirestoreError('getUserSubmittedLaws', error);
    return []; // Return empty array instead of crashing
  }
}
