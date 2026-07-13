/**
 * ContactsService — device contacts for the in-app dialer's Contacts tab.
 */
import { Platform } from 'react-native';

export interface AppContact {
  id: string;
  name: string;
  phoneNumbers: string[];
  initials: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

export async function requestContactsPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Contacts = await import('expo-contacts');
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasContactsPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Contacts = await import('expo-contacts');
  const { status } = await Contacts.getPermissionsAsync();
  return status === 'granted';
}

export async function loadDeviceContacts(): Promise<AppContact[]> {
  if (Platform.OS === 'web') return [];
  const Contacts = await import('expo-contacts');
  const granted = await hasContactsPermission();
  if (!granted) return [];

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
    sort: Contacts.SortTypes.FirstName,
  });

  const contacts: AppContact[] = [];
  for (const c of data) {
    const numbers = (c.phoneNumbers ?? [])
      .map(p => p.number?.replace(/[^\d+]/g, ''))
      .filter((n): n is string => !!n);
    if (numbers.length === 0) continue;
    const name = c.name || 'Unknown';
    contacts.push({
      id: c.id ?? `${name}_${numbers[0]}`,
      name,
      phoneNumbers: Array.from(new Set(numbers)),
      initials: getInitials(name),
    });
  }
  return contacts;
}

export function searchContacts(contacts: AppContact[], query: string): AppContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  const digitsQuery = q.replace(/[^\d]/g, '');
  return contacts.filter(c => {
    if (c.name.toLowerCase().includes(q)) return true;
    if (digitsQuery && c.phoneNumbers.some(n => n.replace(/[^\d]/g, '').includes(digitsQuery))) return true;
    return false;
  });
}
