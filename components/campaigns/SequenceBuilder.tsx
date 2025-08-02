'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Trash2, 
  Mail, 
  Clock, 
  ArrowDown,
  Settings,
  Eye,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface EmailStep {
  id: string
  stepNumber: number
  subject: string
  content: string
  delayDays: number
  conditions: StepCondition[]
}

interface StepCondition {
  type: 'reply_received' | 'email_opened' | 'link_clicked' | 'time_elapsed'
  action: 'stop_sequence' | 'skip_step' | 'branch_to_step'
  value?: any
}

interface SequenceBuilderProps {
  sequence: EmailStep[]
  onChange: (sequence: EmailStep[]) => void
  errors?: Record<string, string>
}

export function SequenceBuilder({ sequence, onChange, errors = {} }: SequenceBuilderProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(['1']))
  const [previewStep, setPreviewStep] = useState<string | null>(null)

  const addStep = () => {
    const newStep: EmailStep = {
      id: Date.now().toString(),
      stepNumber: sequence.length + 1,
      subject: '',
      content: '',
      delayDays: sequence.length === 0 ? 0 : 3,
      conditions: []
    }
    onChange([...sequence, newStep])
    setExpandedSteps(prev => new Set([...Array.from(prev), newStep.id]))
  }

  const removeStep = (stepId: string) => {
    const updatedSequence = sequence
      .filter(step => step.id !== stepId)
      .map((step, index) => ({ ...step, stepNumber: index + 1 }))
    onChange(updatedSequence)
    setExpandedSteps(prev => {
      const newSet = new Set(prev)
      newSet.delete(stepId)
      return newSet
    })
  }

  const updateStep = (stepId: string, updates: Partial<EmailStep>) => {
    const updatedSequence = sequence.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    )
    onChange(updatedSequence)
  }

  const duplicateStep = (stepId: string) => {
    const stepToDuplicate = sequence.find(step => step.id === stepId)
    if (!stepToDuplicate) return

    const newStep: EmailStep = {
      ...stepToDuplicate,
      id: Date.now().toString(),
      stepNumber: sequence.length + 1,
      subject: `${stepToDuplicate.subject} (Copy)`
    }
    onChange([...sequence, newStep])
  }

  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }

  const addCondition = (stepId: string) => {
    const newCondition: StepCondition = {
      type: 'reply_received',
      action: 'stop_sequence'
    }
    
    updateStep(stepId, {
      conditions: [...(sequence.find(s => s.id === stepId)?.conditions || []), newCondition]
    })
  }

  const removeCondition = (stepId: string, conditionIndex: number) => {
    const step = sequence.find(s => s.id === stepId)
    if (!step) return

    const updatedConditions = step.conditions.filter((_, index) => index !== conditionIndex)
    updateStep(stepId, { conditions: updatedConditions })
  }

  const updateCondition = (stepId: string, conditionIndex: number, updates: Partial<StepCondition>) => {
    const step = sequence.find(s => s.id === stepId)
    if (!step) return

    const updatedConditions = step.conditions.map((condition, index) =>
      index === conditionIndex ? { ...condition, ...updates } : condition
    )
    updateStep(stepId, { conditions: updatedConditions })
  }

  const getConditionLabel = (condition: StepCondition) => {
    const typeLabels = {
      'reply_received': 'Reply received',
      'email_opened': 'Email opened',
      'link_clicked': 'Link clicked',
      'time_elapsed': 'Time elapsed'
    }
    
    const actionLabels = {
      'stop_sequence': 'Stop sequence',
      'skip_step': 'Skip next step',
      'branch_to_step': 'Jump to step'
    }

    return `${typeLabels[condition.type]} → ${actionLabels[condition.action]}`
  }

  return (
    <div className="space-y-4">
      {sequence.map((step, index) => {
        const isExpanded = expandedSteps.has(step.id)
        const hasError = errors[`step_${index}_subject`] || errors[`step_${index}_content`]

        return (
          <div key={step.id}>
            <Card className={`${hasError ? 'border-red-300' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-medium text-sm">
                      {step.stepNumber}
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {step.subject || `Email Step ${step.stepNumber}`}
                      </CardTitle>
                      {step.delayDays > 0 && (
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          {step.delayDays} day{step.delayDays !== 1 ? 's' : ''} delay
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {step.conditions.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {step.conditions.length} condition{step.conditions.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreviewStep(step.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateStep(step.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {sequence.length > 1 && (
                          <DropdownMenuItem 
                            onClick={() => removeStep(step.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStepExpansion(step.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4">
                  {/* Delay Settings */}
                  {step.stepNumber > 1 && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Delay before sending
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="30"
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md"
                          value={step.delayDays}
                          onChange={(e) => updateStep(step.id, { 
                            delayDays: parseInt(e.target.value) || 0 
                          })}
                        />
                        <span className="text-sm text-gray-600">days</span>
                      </div>
                    </div>
                  )}

                  {/* Subject Line */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Subject Line *
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-md ${
                        errors[`step_${index}_subject`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter email subject..."
                      value={step.subject}
                      onChange={(e) => updateStep(step.id, { subject: e.target.value })}
                    />
                    {errors[`step_${index}_subject`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`step_${index}_subject`]}</p>
                    )}
                  </div>

                  {/* Email Content */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Email Content *
                    </label>
                    <textarea
                      className={`w-full px-3 py-2 border rounded-md ${
                        errors[`step_${index}_content`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      rows={6}
                      placeholder="Write your email content here... You can use variables like {{first_name}}, {{company_name}}, etc."
                      value={step.content}
                      onChange={(e) => updateStep(step.id, { content: e.target.value })}
                    />
                    {errors[`step_${index}_content`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`step_${index}_content`]}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Tip: Use variables like {'{first_name}'}, {'{company_name}'}, {'{job_title}'} for personalization
                    </p>
                  </div>

                  {/* Conditions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium">Conditions</label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addCondition(step.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Condition
                      </Button>
                    </div>

                    {step.conditions.length > 0 ? (
                      <div className="space-y-2">
                        {step.conditions.map((condition, conditionIndex) => (
                          <div key={conditionIndex} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                            <select
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                              value={condition.type}
                              onChange={(e) => updateCondition(step.id, conditionIndex, {
                                type: e.target.value as StepCondition['type']
                              })}
                            >
                              <option value="reply_received">Reply received</option>
                              <option value="email_opened">Email opened</option>
                              <option value="link_clicked">Link clicked</option>
                              <option value="time_elapsed">Time elapsed</option>
                            </select>

                            <span className="text-sm text-gray-500">→</span>

                            <select
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                              value={condition.action}
                              onChange={(e) => updateCondition(step.id, conditionIndex, {
                                action: e.target.value as StepCondition['action']
                              })}
                            >
                              <option value="stop_sequence">Stop sequence</option>
                              <option value="skip_step">Skip next step</option>
                              <option value="branch_to_step">Jump to step</option>
                            </select>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCondition(step.id, conditionIndex)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No conditions set. Email will be sent regardless of recipient actions.
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Arrow between steps */}
            {index < sequence.length - 1 && (
              <div className="flex justify-center py-2">
                <ArrowDown className="h-5 w-5 text-gray-400" />
              </div>
            )}
          </div>
        )
      })}

      {/* Add Step Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={addStep}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Email Step</span>
        </Button>
      </div>

      {/* Sequence Summary */}
      {sequence.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Sequence Summary</span>
            </div>
            <div className="text-sm text-blue-700">
              <p>
                {sequence.length} email{sequence.length !== 1 ? 's' : ''} over{' '}
                {sequence.reduce((total, step) => total + step.delayDays, 0)} days
              </p>
              <p className="mt-1">
                {sequence.filter(step => step.conditions.length > 0).length} step{sequence.filter(step => step.conditions.length > 0).length !== 1 ? 's' : ''} with conditions
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Modal would go here */}
      {previewStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Email Preview</h3>
              <Button variant="ghost" onClick={() => setPreviewStep(null)}>
                ×
              </Button>
            </div>
            {(() => {
              const step = sequence.find(s => s.id === previewStep)
              return step ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Subject:</label>
                    <p className="font-medium">{step.subject}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Content:</label>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                      {step.content}
                    </div>
                  </div>
                </div>
              ) : null
            })()}
          </div>
        </div>
      )}
    </div>
  )
}