'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Trash2, 
  Edit, 
  Play,
  Pause,
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  Trophy,
  Zap
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ABTest, ABTestVariant, ABTestResult, ABTestService } from '@/lib/ab-testing'

interface ABTestSetupProps {
  campaignId: string
  onTestCreated?: (test: ABTest) => void
  onTestUpdated?: (test: ABTest) => void
  existingTest?: ABTest
}

export function ABTestSetup({ 
  campaignId, 
  onTestCreated, 
  onTestUpdated, 
  existingTest 
}: ABTestSetupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [testData, setTestData] = useState({
    name: '',
    description: '',
    test_type: 'subject_line' as 'subject_line' | 'content' | 'send_time',
    winner_criteria: 'open_rate' as 'open_rate' | 'click_rate' | 'reply_rate',
    confidence_level: 0.95 as 0.90 | 0.95 | 0.99,
    minimum_sample_size: 100,
    test_duration_hours: 72,
    auto_select_winner: true
  })
  const [variants, setVariants] = useState<Partial<ABTestVariant>[]>([
    {
      name: 'Control (A)',
      is_control: true,
      traffic_percentage: 50,
      subject_template: '',
      content_template: ''
    },
    {
      name: 'Variant B',
      is_control: false,
      traffic_percentage: 50,
      subject_template: '',
      content_template: ''
    }
  ])
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (existingTest) {
      setTestData({
        name: existingTest.name,
        description: existingTest.description || '',
        test_type: existingTest.test_type,
        winner_criteria: existingTest.winner_criteria,
        confidence_level: existingTest.confidence_level,
        minimum_sample_size: existingTest.minimum_sample_size,
        test_duration_hours: existingTest.test_duration_hours,
        auto_select_winner: existingTest.auto_select_winner
      })
      setVariants(existingTest.variants.map(v => ({
        id: v.id,
        name: v.name,
        is_control: v.is_control,
        traffic_percentage: v.traffic_percentage,
        subject_template: v.subject_template,
        content_template: v.content_template,
        send_time_offset_hours: v.send_time_offset_hours
      })))
    }
  }, [existingTest])

  const addVariant = () => {
    if (variants.length >= 5) return

    const newVariant: Partial<ABTestVariant> = {
      name: `Variant ${String.fromCharCode(65 + variants.length)}`,
      is_control: false,
      traffic_percentage: Math.floor(100 / (variants.length + 1)),
      subject_template: '',
      content_template: ''
    }

    // Redistribute traffic evenly
    const updatedVariants = [...variants, newVariant].map(variant => ({
      ...variant,
      traffic_percentage: Math.floor(100 / (variants.length + 1))
    }))

    setVariants(updatedVariants)
  }

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return
    
    const updatedVariants = variants.filter((_, i) => i !== index)
    // Redistribute traffic evenly
    const redistributed = updatedVariants.map(variant => ({
      ...variant,
      traffic_percentage: Math.floor(100 / updatedVariants.length)
    }))
    
    setVariants(redistributed)
  }

  const updateVariant = (index: number, field: string, value: any) => {
    const updatedVariants = [...variants]
    updatedVariants[index] = {
      ...updatedVariants[index],
      [field]: value
    }
    setVariants(updatedVariants)
  }

  const validateTest = (): boolean => {
    const newErrors: string[] = []

    if (!testData.name.trim()) {
      newErrors.push('Test name is required')
    }

    if (variants.length < 2) {
      newErrors.push('At least 2 variants are required')
    }

    const controlVariants = variants.filter(v => v.is_control)
    if (controlVariants.length !== 1) {
      newErrors.push('Exactly one control variant is required')
    }

    const totalTraffic = variants.reduce((sum, v) => sum + (v.traffic_percentage || 0), 0)
    if (Math.abs(totalTraffic - 100) > 0.01) {
      newErrors.push('Traffic percentages must sum to 100%')
    }

    // Validate variant content based on test type
    if (testData.test_type === 'subject_line') {
      const missingSubjects = variants.filter(v => !v.subject_template?.trim())
      if (missingSubjects.length > 0) {
        newErrors.push('All variants must have subject templates for subject line tests')
      }
    }

    if (testData.test_type === 'content') {
      const missingContent = variants.filter(v => !v.content_template?.trim())
      if (missingContent.length > 0) {
        newErrors.push('All variants must have content templates for content tests')
      }
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleSave = async () => {
    if (!validateTest()) return

    try {
      const test = ABTestService.createTest(campaignId, 'user-id', {
        ...testData,
        variants: variants.map(v => ({
          name: v.name,
          subject_template: v.subject_template,
          content_template: v.content_template,
          send_time_offset_hours: v.send_time_offset_hours,
          is_control: v.is_control,
          traffic_percentage: v.traffic_percentage
        }))
      })

      if (existingTest) {
        onTestUpdated?.(test)
      } else {
        onTestCreated?.(test)
      }
      
      setIsOpen(false)
    } catch (error) {
      console.error('Error saving A/B test:', error)
      setErrors(['Failed to save A/B test'])
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={existingTest ? 'outline' : 'default'}>
          {existingTest ? (
            <>
              <Edit className="w-4 h-4 mr-2" />
              Edit A/B Test
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add A/B Test
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingTest ? 'Edit A/B Test' : 'Create A/B Test'}
          </DialogTitle>
          <DialogDescription>
            Set up an A/B test to optimize your email performance
          </DialogDescription>
        </DialogHeader>

        <div className=\"space-y-6\">
          {/* Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-lg\">Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className=\"space-y-4\">
              <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">
                <div>
                  <label className=\"block text-sm font-medium mb-2\">Test Name</label>
                  <input
                    type=\"text\"
                    value={testData.name}
                    onChange={(e) => setTestData(prev => ({ ...prev, name: e.target.value }))}
                    className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                    placeholder=\"e.g., Subject Line Test #1\"
                  />
                </div>
                
                <div>
                  <label className=\"block text-sm font-medium mb-2\">Test Type</label>
                  <Select 
                    value={testData.test_type} 
                    onValueChange={(value: any) => setTestData(prev => ({ ...prev, test_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=\"subject_line\">Subject Line</SelectItem>
                      <SelectItem value=\"content\">Email Content</SelectItem>
                      <SelectItem value=\"send_time\">Send Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className=\"block text-sm font-medium mb-2\">Description (Optional)</label>
                <textarea
                  value={testData.description}
                  onChange={(e) => setTestData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                  placeholder=\"Describe what you're testing...\"
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-lg\">Test Parameters</CardTitle>
            </CardHeader>
            <CardContent className=\"space-y-4\">
              <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
                <div>
                  <label className=\"block text-sm font-medium mb-2\">Winner Criteria</label>
                  <Select 
                    value={testData.winner_criteria} 
                    onValueChange={(value: any) => setTestData(prev => ({ ...prev, winner_criteria: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=\"open_rate\">Open Rate</SelectItem>
                      <SelectItem value=\"click_rate\">Click Rate</SelectItem>
                      <SelectItem value=\"reply_rate\">Reply Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className=\"block text-sm font-medium mb-2\">Confidence Level</label>
                  <Select 
                    value={testData.confidence_level.toString()} 
                    onValueChange={(value) => setTestData(prev => ({ ...prev, confidence_level: parseFloat(value) as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=\"0.90\">90%</SelectItem>
                      <SelectItem value=\"0.95\">95%</SelectItem>
                      <SelectItem value=\"0.99\">99%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className=\"block text-sm font-medium mb-2\">Test Duration (Hours)</label>
                  <input
                    type=\"number\"
                    min=\"24\"
                    max=\"168\"
                    value={testData.test_duration_hours}
                    onChange={(e) => setTestData(prev => ({ ...prev, test_duration_hours: parseInt(e.target.value) || 72 }))}
                    className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                  />
                </div>
              </div>

              <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">
                <div>
                  <label className=\"block text-sm font-medium mb-2\">Minimum Sample Size</label>
                  <input
                    type=\"number\"
                    min=\"50\"
                    max=\"10000\"
                    value={testData.minimum_sample_size}
                    onChange={(e) => setTestData(prev => ({ ...prev, minimum_sample_size: parseInt(e.target.value) || 100 }))}
                    className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                  />
                </div>

                <div className=\"flex items-center gap-2 pt-6\">
                  <input
                    type=\"checkbox\"
                    id=\"auto_select_winner\"
                    checked={testData.auto_select_winner}
                    onChange={(e) => setTestData(prev => ({ ...prev, auto_select_winner: e.target.checked }))}
                    className=\"rounded border-gray-300 focus:ring-2 focus:ring-blue-500\"
                  />
                  <label htmlFor=\"auto_select_winner\" className=\"text-sm font-medium\">
                    Auto-select winner when test completes
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <div className=\"flex items-center justify-between\">
                <CardTitle className=\"text-lg\">Test Variants</CardTitle>
                <Button 
                  onClick={addVariant} 
                  disabled={variants.length >= 5}
                  size=\"sm\"
                  variant=\"outline\"
                >
                  <Plus className=\"w-4 h-4 mr-2\" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent className=\"space-y-4\">
              {variants.map((variant, index) => (
                <Card key={index} className={variant.is_control ? 'border-blue-200 bg-blue-50' : ''}>
                  <CardContent className=\"p-4\">
                    <div className=\"flex items-center justify-between mb-4\">
                      <div className=\"flex items-center gap-2\">
                        <input
                          type=\"text\"
                          value={variant.name || ''}
                          onChange={(e) => updateVariant(index, 'name', e.target.value)}
                          className=\"font-medium bg-transparent border-none focus:outline-none focus:ring-0\"
                        />
                        {variant.is_control && (
                          <Badge variant=\"secondary\">Control</Badge>
                        )}
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <span className=\"text-sm text-gray-500\">Traffic:</span>
                        <input
                          type=\"number\"
                          min=\"10\"
                          max=\"90\"
                          value={variant.traffic_percentage || 0}
                          onChange={(e) => updateVariant(index, 'traffic_percentage', parseInt(e.target.value) || 0)}
                          className=\"w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500\"
                        />
                        <span className=\"text-sm text-gray-500\">%</span>
                        {!variant.is_control && variants.length > 2 && (
                          <Button
                            onClick={() => removeVariant(index)}
                            size=\"sm\"
                            variant=\"ghost\"
                          >
                            <Trash2 className=\"w-4 h-4\" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {testData.test_type === 'subject_line' && (
                      <div>
                        <label className=\"block text-sm font-medium mb-2\">Subject Line</label>
                        <input
                          type=\"text\"
                          value={variant.subject_template || ''}
                          onChange={(e) => updateVariant(index, 'subject_template', e.target.value)}
                          className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                          placeholder=\"Enter subject line...\"
                        />
                      </div>
                    )}

                    {testData.test_type === 'content' && (
                      <div>
                        <label className=\"block text-sm font-medium mb-2\">Email Content</label>
                        <textarea
                          value={variant.content_template || ''}
                          onChange={(e) => updateVariant(index, 'content_template', e.target.value)}
                          rows={4}
                          className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                          placeholder=\"Enter email content...\"
                        />
                      </div>
                    )}

                    {testData.test_type === 'send_time' && (
                      <div>
                        <label className=\"block text-sm font-medium mb-2\">Send Time Offset (Hours)</label>
                        <input
                          type=\"number\"
                          min=\"-12\"
                          max=\"12\"
                          value={variant.send_time_offset_hours || 0}
                          onChange={(e) => updateVariant(index, 'send_time_offset_hours', parseInt(e.target.value) || 0)}
                          className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
                          placeholder=\"0\"
                        />
                        <p className=\"text-xs text-gray-500 mt-1\">
                          Positive values delay sending, negative values send earlier
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Errors */}
          {errors.length > 0 && (
            <Card className=\"border-red-200 bg-red-50\">
              <CardContent className=\"p-4\">
                <div className=\"flex items-center gap-2 text-red-800 mb-2\">
                  <AlertCircle className=\"w-4 h-4\" />
                  <span className=\"font-medium\">Please fix the following errors:</span>
                </div>
                <ul className=\"text-sm text-red-700 space-y-1\">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className=\"flex justify-end gap-2 pt-4 border-t\">
          <Button variant=\"outline\" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {existingTest ? 'Update Test' : 'Create Test'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}"