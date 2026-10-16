export const CONTENT_TABS = [
  { id: 'mine', label: 'My content' },
  { id: 'favorites', label: 'My favorites' },
  { id: 'groups', label: 'My groups' },
  { id: 'org', label: 'My organization' },
] as const

export type ContentTab = (typeof CONTENT_TABS)[number]['id']

export const GROUPS_TABS = [
  { id: 'mine', label: 'My groups' },
  { id: 'featured', label: 'Featured groups' },
  { id: 'org', label: "My organization's groups" },
] as const

export type GroupsTab = (typeof GROUPS_TABS)[number]['id']

export const ORG_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'status', label: 'Status' },
] as const

export type OrgTab = (typeof ORG_TABS)[number]['id']
