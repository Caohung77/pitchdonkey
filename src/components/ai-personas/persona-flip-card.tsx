'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Mail, Edit, Eye, Power, Bot, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ApiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { AIPersona } from '@/lib/ai-personas'
import { cn } from '@/lib/utils'

interface PersonaFlipCardProps {
  persona: AIPersona
  onUpdate?: () => void
}

export function PersonaFlipCard({ persona, onUpdate }: PersonaFlipCardProps) {
  const router = useRouter()
  const [isFlipped, setIsFlipped] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const personaTypeLabels: Record<string, string> = {
    customer_support: 'Customer Support',
    sales_rep: 'Sales Rep',
    sales_development: 'SDR',
    account_manager: 'Account Manager',
    consultant: 'Consultant',
    technical_specialist: 'Technical',
    success_manager: 'Success Manager',
    marketing_specialist: 'Marketing',
    custom: 'Custom'
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 border-green-200',
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    inactive: 'bg-red-100 text-red-800 border-red-200'
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const handleCardClick = () => {
    setIsFlipped(!isFlipped)
  }

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/dashboard/ai-personas/${persona.id}`)
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/dashboard/ai-personas/${persona.id}?tab=settings`)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    console.log('🚀 handleDeleteConfirm CALLED!')
    console.log('🎯 Persona to delete:', { id: persona.id, name: persona.name })

    try {
      setIsDeleting(true)
      console.log('🗑️ Starting delete API call for persona:', persona.id)

      const response = await ApiClient.delete(`/api/ai-personas/${persona.id}`)

      console.log('✅ Persona deleted successfully! Response:', response)

      toast.success('AI Persona deleted', {
        description: `${persona.name} has been permanently deleted.`
      })

      // Refresh the personas list
      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      console.error('❌ Error deleting persona:', error)
      toast.error('Failed to delete persona', {
        description: error?.message || 'Please try again.'
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div
      className="perspective-1000 h-[420px] cursor-pointer"
      onClick={handleCardClick}
    >
      <div
        className={cn(
          "relative w-full h-full transition-transform duration-500 preserve-3d",
          isFlipped && "rotate-y-180"
        )}
      >
        {/* Front - Avatar */}
        <div className="absolute w-full h-full backface-hidden" style={{ zIndex: 2 }}>
          <div className="h-full rounded-xl border-2 bg-card hover:shadow-xl transition-shadow overflow-hidden flex flex-col">
            {/* Status Badge */}
            <div className="absolute top-4 right-4 z-10">
              <Badge className={statusColors[persona.status]} variant="outline">
                {persona.status}
              </Badge>
            </div>

            {/* Avatar Container */}
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="relative">
                <Avatar className="h-64 w-64 border-4 border-primary/20 shadow-2xl">
                  {persona.avatar_url ? (
                    <AvatarImage
                      src={persona.avatar_url}
                      alt={persona.sender_name || persona.name}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-6xl font-semibold">
                      {getInitials(persona.sender_name || persona.name)}
                    </AvatarFallback>
                  )}
                </Avatar>

                {/* Status Indicator */}
                {persona.status === 'active' && (
                  <div className="absolute bottom-4 right-4 h-8 w-8 bg-green-500 rounded-full border-4 border-white shadow-lg" />
                )}
              </div>
            </div>

            {/* Name Footer */}
            <div className="bg-gradient-to-t from-background to-transparent p-6 text-center">
              <h3 className="text-2xl font-bold mb-1">
                {persona.sender_name || persona.name}
              </h3>
              <p className="text-muted-foreground">
                {persona.sender_role || personaTypeLabels[persona.persona_type]}
              </p>
            </div>
          </div>
        </div>

        {/* Back - Details */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180" style={{ zIndex: 1 }}>
          <div className="h-full rounded-xl border-2 bg-background hover:shadow-xl transition-shadow overflow-hidden flex flex-col p-6">
            {/* Header with small avatar */}
            <div className="flex items-center gap-3 mb-5">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                {persona.avatar_url ? (
                  <AvatarImage src={persona.avatar_url} alt={persona.sender_name || persona.name} />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(persona.sender_name || persona.name)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">
                  {persona.sender_name || persona.name}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {persona.sender_role || personaTypeLabels[persona.persona_type]}
                </p>
              </div>
              <Badge className={statusColors[persona.status]} variant="outline">
                {persona.status}
              </Badge>
            </div>

            {/* Persona Type */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Bot className="h-4 w-4" />
              <span>{personaTypeLabels[persona.persona_type]}</span>
            </div>

            {/* Personality Traits */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">Personality</p>
              <div className="flex flex-wrap gap-1">
                {persona.personality_traits.communication_style && (
                  <Badge variant="secondary" className="text-xs">
                    {persona.personality_traits.communication_style}
                  </Badge>
                )}
                {persona.personality_traits.empathy_level && (
                  <Badge variant="secondary" className="text-xs">
                    {persona.personality_traits.empathy_level} empathy
                  </Badge>
                )}
                {persona.personality_traits.expertise_depth && (
                  <Badge variant="secondary" className="text-xs">
                    {persona.personality_traits.expertise_depth}
                  </Badge>
                )}
              </div>
            </div>

            {/* Stats - Compact Design */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none mb-0.5">{persona.total_chats || 0}</p>
                  <p className="text-xs text-muted-foreground">Chats</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none mb-0.5">{persona.total_emails_handled || 0}</p>
                  <p className="text-xs text-muted-foreground">Emails</p>
                </div>
              </div>
            </div>

            {/* Actions - Increased bottom spacing */}
            <div className="mt-auto space-y-2 pt-4 pb-2">
              <Button
                variant="default"
                className="w-full gap-2"
                onClick={handleDetailsClick}
              >
                <Eye className="h-4 w-4" />
                View Details
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleEditClick}
              >
                <Edit className="h-4 w-4" />
                Edit Persona
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleDeleteClick}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? 'Deleting...' : 'Delete Persona'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete AI Persona"
        description={`Are you sure you want to delete "${persona.name}"? This action cannot be undone and will permanently remove all associated data.`}
        confirmText="Delete Persona"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
