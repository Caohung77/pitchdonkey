import { createServerSupabaseClient } from './supabase'

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  description?: string
  usage_count: number
  created_at: string
  updated_at: string
}

export interface ContactTag {
  id: string
  contact_id: string
  tag_id: string
  created_at: string
}

export interface CreateTagData {
  name: string
  color?: string
  description?: string
}

export interface UpdateTagData {
  name?: string
  color?: string
  description?: string
}

// Default colors for new tags
export const DEFAULT_TAG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#EC4899', // pink
  '#6B7280', // gray
]

/**
 * Get all tags for a user, sorted by usage count
 */
export async function getUserTags(userId: string): Promise<Tag[]> {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .order('name')

  if (error) {
    console.error('Error fetching user tags:', error)
    throw new Error(`Failed to fetch tags: ${error.message}`)
  }

  return data || []
}

/**
 * Search tags by name with autocomplete suggestions
 */
export async function searchUserTags(userId: string, query: string): Promise<Tag[]> {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`)
    .order('usage_count', { ascending: false })
    .order('name')
    .limit(10) // Limit for autocomplete

  if (error) {
    console.error('Error searching user tags:', error)
    throw new Error(`Failed to search tags: ${error.message}`)
  }

  return data || []
}

/**
 * Create a new tag for a user
 */
export async function createTag(userId: string, tagData: CreateTagData): Promise<Tag> {
  const supabase = createServerSupabaseClient()
  
  // Assign a random color if none provided
  const color = tagData.color || DEFAULT_TAG_COLORS[Math.floor(Math.random() * DEFAULT_TAG_COLORS.length)]
  
  const { data, error } = await supabase
    .from('tags')
    .insert({
      user_id: userId,
      name: tagData.name.trim(),
      color,
      description: tagData.description?.trim() || null,
      usage_count: 0
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A tag with this name already exists')
    }
    console.error('Error creating tag:', error)
    throw new Error(`Failed to create tag: ${error.message}`)
  }

  return data
}

/**
 * Update an existing tag
 */
export async function updateTag(userId: string, tagId: string, tagData: UpdateTagData): Promise<Tag> {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('tags')
    .update({
      ...tagData,
      name: tagData.name?.trim(),
      description: tagData.description?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', tagId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A tag with this name already exists')
    }
    console.error('Error updating tag:', error)
    throw new Error(`Failed to update tag: ${error.message}`)
  }

  return data
}

/**
 * Delete a tag (will also remove all contact associations)
 */
export async function deleteTag(userId: string, tagId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting tag:', error)
    throw new Error(`Failed to delete tag: ${error.message}`)
  }
}

/**
 * Get all tags for a specific contact
 */
export async function getContactTags(contactId: string): Promise<Tag[]> {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('contact_tags')
    .select(`
      tags (
        id,
        name,
        color,
        description,
        usage_count
      )
    `)
    .eq('contact_id', contactId)

  if (error) {
    console.error('Error fetching contact tags:', error)
    throw new Error(`Failed to fetch contact tags: ${error.message}`)
  }

  return data?.map(item => item.tags).filter(Boolean) as Tag[] || []
}

/**
 * Add tags to a contact
 */
export async function addTagsToContact(contactId: string, tagIds: string[]): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  // Insert contact-tag relationships
  const contactTags = tagIds.map(tagId => ({
    contact_id: contactId,
    tag_id: tagId
  }))

  const { error } = await supabase
    .from('contact_tags')
    .insert(contactTags)

  if (error) {
    console.error('Error adding tags to contact:', error)
    throw new Error(`Failed to add tags to contact: ${error.message}`)
  }

  // Sync to legacy field
  await syncTagsToLegacyField(contactId)
}

/**
 * Remove tags from a contact
 */
export async function removeTagsFromContact(contactId: string, tagIds: string[]): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  const { error } = await supabase
    .from('contact_tags')
    .delete()
    .eq('contact_id', contactId)
    .in('tag_id', tagIds)

  if (error) {
    console.error('Error removing tags from contact:', error)
    throw new Error(`Failed to remove tags from contact: ${error.message}`)
  }

  // Sync to legacy field
  await syncTagsToLegacyField(contactId)
}

/**
 * Set tags for a contact (replaces all existing tags)
 */
export async function setContactTags(contactId: string, tagIds: string[]): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  // Start a transaction - remove existing contact_tags relationships
  const { error: deleteError } = await supabase
    .from('contact_tags')
    .delete()
    .eq('contact_id', contactId)

  if (deleteError) {
    console.error('Error removing existing tags:', deleteError)
    throw new Error(`Failed to update contact tags: ${deleteError.message}`)
  }

  // Add new contact_tags relationships
  if (tagIds.length > 0) {
    const contactTags = tagIds.map(tagId => ({
      contact_id: contactId,
      tag_id: tagId
    }))

    const { error: insertError } = await supabase
      .from('contact_tags')
      .insert(contactTags)

    if (insertError) {
      console.error('Error adding new tags:', insertError)
      throw new Error(`Failed to update contact tags: ${insertError.message}`)
    }
  }

  // Also update the legacy tags field in the contacts table for backward compatibility
  await syncTagsToLegacyField(contactId)
}

/**
 * Sync tags from new tagging system back to legacy tags field
 */
async function syncTagsToLegacyField(contactId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  // Get all tag names for this contact from the new system
  const { data: tagData, error: tagError } = await supabase
    .from('contact_tags')
    .select(`
      tags (
        name
      )
    `)
    .eq('contact_id', contactId)

  if (tagError) {
    console.error('Error fetching tags for legacy sync:', tagError)
    return // Don't fail the whole operation for legacy sync
  }

  // Extract tag names
  const tagNames = tagData?.map(item => item.tags?.name).filter(Boolean) || []

  // Update the legacy tags field
  const { error: updateError } = await supabase
    .from('contacts')
    .update({ 
      tags: tagNames,
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId)

  if (updateError) {
    console.error('Error syncing tags to legacy field:', updateError)
    // Don't throw error - this is just for backward compatibility
  }
}

/**
 * Get contacts by tag
 */
export async function getContactsByTag(userId: string, tagId: string): Promise<any[]> {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('contact_tags')
    .select(`
      contacts (
        id,
        email,
        first_name,
        last_name,
        company,
        position,
        status,
        created_at
      )
    `)
    .eq('tag_id', tagId)
    .eq('contacts.user_id', userId)

  if (error) {
    console.error('Error fetching contacts by tag:', error)
    throw new Error(`Failed to fetch contacts by tag: ${error.message}`)
  }

  return data?.map(item => item.contacts).filter(Boolean) || []
}