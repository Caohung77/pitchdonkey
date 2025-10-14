'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ABTestSetupProps {
  campaignId: string
  onTestCreated?: (test: any) => void
  onTestUpdated?: (test: any) => void
  existingTest?: any
}

export function ABTestSetup({ 
  campaignId, 
  onTestCreated, 
  onTestUpdated, 
  existingTest 
}: ABTestSetupProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSave = async () => {
    // Mock implementation for now
    console.log('Saving A/B test for campaign:', campaignId)
    setIsOpen(false)
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Test Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Subject Line Test #1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Test Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="subject_line">Subject Line</option>
                    <option value="content">Email Content</option>
                    <option value="send_time">Send Time</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what you're testing..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                A/B test configuration will be implemented here.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {existingTest ? 'Update Test' : 'Create Test'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}