import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, full_name, subscription_tier, subscription_status')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      // Return basic user data if profile doesn't exist
      const fallbackUserData = {
        id: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email,
        plan: 'starter',
        subscriptionStatus: 'active'
      }
      return createSuccessResponse(fallbackUserData)
    }

    const userData = {
      id: profile.id,
      name: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      email: profile.email || user.email,
      plan: profile.subscription_tier || 'starter',
      subscriptionStatus: profile.subscription_status || 'active'
    }

    return createSuccessResponse(userData)

  } catch (error) {
    return handleApiError(error)
  }
})

export const PUT = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()
    
    const body = await request.json()
    const { name } = body

    // Update user profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('users')
      .update({ full_name: name })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      return handleApiError(updateError)
    }

    return createSuccessResponse(updatedProfile)

  } catch (error) {
    return handleApiError(error)
  }
})