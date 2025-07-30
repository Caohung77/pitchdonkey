import { z } from 'zod'

// Core A/B testing interfaces
export interface ABTest {
  id: string
  campaign_id: string
  user_id: string
  name: string
  description?: string
  test_type: 'subject_line' | 'content' | 'send_time'
  status: 'draft' | 'running' | 'completed' | 'stopped'
  variants: ABTestVariant[]
  traffic_split: number[] // percentages that sum to 100
  winner_criteria: 'open_rate' | 'click_rate' | 'reply_rate'
  confidence_level: 0.90 | 0.95 | 0.99
  minimum_sample_size: number
  test_duration_hours: number
  auto_select_winner: boolean
  winner_variant_id?: string
  statistical_significance: boolean
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface ABTestVariant {
  id: string
  ab_test_id: string
  name: string
  subject_template?: string
  content_template?: string
  send_time_offset_hours?: number
  is_control: boolean
  traffic_percentage: number
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  created_at: string
  updated_at: string
}

export interface ABTestResult {
  ab_test_id: string
  variant_id: string
  variant_name: string
  is_control: boolean
  is_winner: boolean
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  delivery_rate: number
  open_rate: number
  click_rate: number
  reply_rate: number
  metric_value: number // based on winner_criteria
  confidence_interval: [number, number]
  p_value: number
  statistical_significance: boolean
  lift_percentage: number // vs control
  created_at: string
  updated_at: string
}

export interface ABTestAnalysis {
  ab_test_id: string
  status: 'insufficient_data' | 'running' | 'significant' | 'inconclusive'
  winner_variant_id?: string
  confidence_level: number
  p_value: number
  statistical_power: number
  sample_size_reached: boolean
  duration_completed: boolean
  results: ABTestResult[]
  recommendations: string[]
  created_at: string
}

// Validation schemas
export const abTestVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required').max(100),
  subject_template: z.string().optional(),
  content_template: z.string().optional(),
  send_time_offset_hours: z.number().min(-12).max(12).optional(),
  is_control: z.boolean(),
  traffic_percentage: z.number().min(10).max(90)
})

export const abTestSchema = z.object({
  name: z.string().min(1, 'Test name is required').max(100),
  description: z.string().max(500).optional(),
  test_type: z.enum(['subject_line', 'content', 'send_time']),
  variants: z.array(abTestVariantSchema).min(2, 'At least 2 variants required').max(5, 'Maximum 5 variants allowed'),
  winner_criteria: z.enum(['open_rate', 'click_rate', 'reply_rate']).default('open_rate'),
  confidence_level: z.enum([0.90, 0.95, 0.99]).default(0.95),
  minimum_sample_size: z.number().min(50).max(10000).default(100),
  test_duration_hours: z.number().min(24).max(168).default(72), // 1-7 days
  auto_select_winner: z.boolean().default(true)
}).refine(data => {
  // Ensure exactly one control variant
  const controlVariants = data.variants.filter(v => v.is_control)
  return controlVariants.length === 1
}, {
  message: 'Exactly one control variant is required'
}).refine(data => {
  // Ensure traffic percentages sum to 100
  const totalTraffic = data.variants.reduce((sum, v) => sum + v.traffic_percentage, 0)
  return Math.abs(totalTraffic - 100) < 0.01
}, {
  message: 'Traffic percentages must sum to 100%'
}).refine(data => {
  // Validate variant content based on test type
  if (data.test_type === 'subject_line') {
    return data.variants.every(v => v.subject_template)
  }
  if (data.test_type === 'content') {
    return data.variants.every(v => v.content_template)
  }
  if (data.test_type === 'send_time') {
    return data.variants.every(v => v.send_time_offset_hours !== undefined)
  }
  return true
}, {
  message: 'All variants must have content appropriate for the test type'
})

// Statistical analysis utilities
export class ABTestStatistics {
  /**
   * Calculate statistical significance using two-proportion z-test
   */
  static calculateSignificance(
    controlSuccesses: number,
    controlTotal: number,
    variantSuccesses: number,
    variantTotal: number,
    confidenceLevel: number = 0.95
  ): {
    pValue: number
    isSignificant: boolean
    confidenceInterval: [number, number]
    lift: number
  } {
    if (controlTotal === 0 || variantTotal === 0) {
      return {
        pValue: 1,
        isSignificant: false,
        confidenceInterval: [0, 0],
        lift: 0
      }
    }

    const p1 = controlSuccesses / controlTotal
    const p2 = variantSuccesses / variantTotal
    
    // Pooled proportion
    const pPool = (controlSuccesses + variantSuccesses) / (controlTotal + variantTotal)
    
    // Standard error
    const se = Math.sqrt(pPool * (1 - pPool) * (1/controlTotal + 1/variantTotal))
    
    // Z-score
    const z = Math.abs(p2 - p1) / se
    
    // P-value (two-tailed test)
    const pValue = 2 * (1 - this.normalCDF(z))
    
    // Critical value for confidence level
    const alpha = 1 - confidenceLevel
    const criticalValue = this.normalInverse(1 - alpha/2)
    
    const isSignificant = z > criticalValue
    
    // Confidence interval for difference
    const seDiff = Math.sqrt(p1 * (1 - p1) / controlTotal + p2 * (1 - p2) / variantTotal)
    const margin = criticalValue * seDiff
    const diff = p2 - p1
    
    const confidenceInterval: [number, number] = [
      diff - margin,
      diff + margin
    ]
    
    // Lift percentage
    const lift = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0
    
    return {
      pValue,
      isSignificant,
      confidenceInterval,
      lift
    }
  }

  /**
   * Calculate required sample size for A/B test
   */
  static calculateSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number,
    confidenceLevel: number = 0.95,
    statisticalPower: number = 0.80
  ): number {
    const alpha = 1 - confidenceLevel
    const beta = 1 - statisticalPower
    
    const zAlpha = this.normalInverse(1 - alpha/2)
    const zBeta = this.normalInverse(1 - beta)
    
    const p1 = baselineRate
    const p2 = baselineRate * (1 + minimumDetectableEffect)
    
    const pooledP = (p1 + p2) / 2
    const pooledSE = Math.sqrt(2 * pooledP * (1 - pooledP))
    const diffSE = Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))
    
    const n = Math.pow((zAlpha * pooledSE + zBeta * diffSE) / (p2 - p1), 2)
    
    return Math.ceil(n)
  }

  /**
   * Calculate statistical power of current test
   */
  static calculatePower(
    controlSuccesses: number,
    controlTotal: number,
    variantSuccesses: number,
    variantTotal: number,
    confidenceLevel: number = 0.95
  ): number {
    if (controlTotal === 0 || variantTotal === 0) return 0

    const p1 = controlSuccesses / controlTotal
    const p2 = variantSuccesses / variantTotal
    const diff = Math.abs(p2 - p1)
    
    if (diff === 0) return 0

    const alpha = 1 - confidenceLevel
    const zAlpha = this.normalInverse(1 - alpha/2)
    
    const se1 = Math.sqrt(p1 * (1 - p1) / controlTotal)
    const se2 = Math.sqrt(p2 * (1 - p2) / variantTotal)
    const seDiff = Math.sqrt(se1 * se1 + se2 * se2)
    
    const zBeta = (diff - zAlpha * seDiff) / seDiff
    const power = this.normalCDF(zBeta)
    
    return Math.max(0, Math.min(1, power))
  }

  /**
   * Normal cumulative distribution function
   */
  private static normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)))
  }

  /**
   * Inverse normal cumulative distribution function
   */
  private static normalInverse(p: number): number {
    // Approximation using Beasley-Springer-Moro algorithm
    const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
    const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]

    if (p <= 0 || p >= 1) {
      throw new Error('p must be between 0 and 1')
    }

    let q = p - 0.5
    let r: number

    if (Math.abs(q) <= 0.425) {
      r = 0.180625 - q * q
      return q * (((((((a[7] * r + a[6]) * r + a[5]) * r + a[4]) * r + a[3]) * r + a[2]) * r + a[1]) * r + a[0]) /
        (((((((b[7] * r + b[6]) * r + b[5]) * r + b[4]) * r + b[3]) * r + b[2]) * r + b[1]) * r + 1)
    }

    r = q < 0 ? p : 1 - p
    r = Math.sqrt(-Math.log(r))

    let ret: number
    if (r <= 5) {
      r -= 1.6
      ret = (((((((c[7] * r + c[6]) * r + c[5]) * r + c[4]) * r + c[3]) * r + c[2]) * r + c[1]) * r + c[0]) /
        ((((((d[6] * r + d[5]) * r + d[4]) * r + d[3]) * r + d[2]) * r + d[1]) * r + 1)
    } else {
      r -= 5
      ret = (((((((c[7] * r + c[6]) * r + c[5]) * r + c[4]) * r + c[3]) * r + c[2]) * r + c[1]) * r + c[0]) /
        ((((((d[6] * r + d[5]) * r + d[4]) * r + d[3]) * r + d[2]) * r + d[1]) * r + 1)
    }

    return q < 0 ? -ret : ret
  }

  /**
   * Error function approximation
   */
  private static erf(x: number): number {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x >= 0 ? 1 : -1
    x = Math.abs(x)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return sign * y
  }
}

// A/B test management service
export class ABTestService {
  /**
   * Create a new A/B test
   */
  static createTest(campaignId: string, userId: string, testData: any): ABTest {
    const validatedData = abTestSchema.parse(testData)
    
    const test: ABTest = {
      id: crypto.randomUUID(),
      campaign_id: campaignId,
      user_id: userId,
      name: validatedData.name,
      description: validatedData.description,
      test_type: validatedData.test_type,
      status: 'draft',
      variants: validatedData.variants.map(variant => ({
        id: crypto.randomUUID(),
        ab_test_id: '', // Will be set after test creation
        name: variant.name,
        subject_template: variant.subject_template,
        content_template: variant.content_template,
        send_time_offset_hours: variant.send_time_offset_hours,
        is_control: variant.is_control,
        traffic_percentage: variant.traffic_percentage,
        emails_sent: 0,
        emails_delivered: 0,
        emails_opened: 0,
        emails_clicked: 0,
        emails_replied: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })),
      traffic_split: validatedData.variants.map(v => v.traffic_percentage),
      winner_criteria: validatedData.winner_criteria,
      confidence_level: validatedData.confidence_level,
      minimum_sample_size: validatedData.minimum_sample_size,
      test_duration_hours: validatedData.test_duration_hours,
      auto_select_winner: validatedData.auto_select_winner,
      statistical_significance: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Set ab_test_id for variants
    test.variants = test.variants.map(variant => ({
      ...variant,
      ab_test_id: test.id
    }))

    return test
  }

  /**
   * Assign contact to A/B test variant
   */
  static assignVariant(test: ABTest, contactId: string): ABTestVariant {
    // Use contact ID as seed for consistent assignment
    const hash = this.hashString(contactId + test.id)
    const random = (hash % 10000) / 10000 // 0-1 range

    let cumulativePercentage = 0
    for (const variant of test.variants) {
      cumulativePercentage += variant.traffic_percentage / 100
      if (random <= cumulativePercentage) {
        return variant
      }
    }

    // Fallback to control variant
    return test.variants.find(v => v.is_control) || test.variants[0]
  }

  /**
   * Analyze A/B test results
   */
  static analyzeTest(test: ABTest): ABTestAnalysis {
    const controlVariant = test.variants.find(v => v.is_control)
    if (!controlVariant) {
      throw new Error('No control variant found')
    }

    const results: ABTestResult[] = test.variants.map(variant => {
      const metricValue = this.getMetricValue(variant, test.winner_criteria)
      const controlMetricValue = this.getMetricValue(controlVariant, test.winner_criteria)
      
      let significance = { pValue: 1, isSignificant: false, confidenceInterval: [0, 0] as [number, number], lift: 0 }
      
      if (variant.id !== controlVariant.id) {
        const controlSuccesses = this.getSuccessCount(controlVariant, test.winner_criteria)
        const variantSuccesses = this.getSuccessCount(variant, test.winner_criteria)
        
        significance = ABTestStatistics.calculateSignificance(
          controlSuccesses,
          controlVariant.emails_sent,
          variantSuccesses,
          variant.emails_sent,
          test.confidence_level
        )
      }

      return {
        ab_test_id: test.id,
        variant_id: variant.id,
        variant_name: variant.name,
        is_control: variant.is_control,
        is_winner: false, // Will be determined later
        emails_sent: variant.emails_sent,
        emails_delivered: variant.emails_delivered,
        emails_opened: variant.emails_opened,
        emails_clicked: variant.emails_clicked,
        emails_replied: variant.emails_replied,
        delivery_rate: variant.emails_sent > 0 ? (variant.emails_delivered / variant.emails_sent) * 100 : 0,
        open_rate: variant.emails_delivered > 0 ? (variant.emails_opened / variant.emails_delivered) * 100 : 0,
        click_rate: variant.emails_opened > 0 ? (variant.emails_clicked / variant.emails_opened) * 100 : 0,
        reply_rate: variant.emails_sent > 0 ? (variant.emails_replied / variant.emails_sent) * 100 : 0,
        metric_value: metricValue,
        confidence_interval: significance.confidenceInterval,
        p_value: significance.pValue,
        statistical_significance: significance.isSignificant,
        lift_percentage: significance.lift,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })

    // Determine winner
    const significantResults = results.filter(r => r.statistical_significance && !r.is_control)
    let winnerVariantId: string | undefined

    if (significantResults.length > 0) {
      // Find variant with highest metric value among significant results
      const winner = significantResults.reduce((best, current) => 
        current.metric_value > best.metric_value ? current : best
      )
      winnerVariantId = winner.variant_id
      winner.is_winner = true
    }

    // Calculate overall test status
    const totalSampleSize = test.variants.reduce((sum, v) => sum + v.emails_sent, 0)
    const sampleSizeReached = totalSampleSize >= test.minimum_sample_size
    const durationCompleted = test.started_at ? 
      (Date.now() - new Date(test.started_at).getTime()) >= (test.test_duration_hours * 60 * 60 * 1000) : false

    let status: ABTestAnalysis['status'] = 'insufficient_data'
    if (sampleSizeReached && durationCompleted) {
      status = winnerVariantId ? 'significant' : 'inconclusive'
    } else if (sampleSizeReached || durationCompleted) {
      status = 'running'
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(test, results, status)

    // Calculate statistical power
    const controlResult = results.find(r => r.is_control)!
    const bestVariantResult = results.filter(r => !r.is_control).reduce((best, current) => 
      current.metric_value > best.metric_value ? current : best
    )
    
    const statisticalPower = ABTestStatistics.calculatePower(
      this.getSuccessCount(controlVariant, test.winner_criteria),
      controlVariant.emails_sent,
      this.getSuccessCount(test.variants.find(v => v.id === bestVariantResult.variant_id)!, test.winner_criteria),
      bestVariantResult.emails_sent,
      test.confidence_level
    )

    return {
      ab_test_id: test.id,
      status,
      winner_variant_id: winnerVariantId,
      confidence_level: test.confidence_level,
      p_value: Math.min(...results.filter(r => !r.is_control).map(r => r.p_value)),
      statistical_power: statisticalPower,
      sample_size_reached: sampleSizeReached,
      duration_completed: durationCompleted,
      results,
      recommendations,
      created_at: new Date().toISOString()
    }
  }

  /**
   * Get metric value based on winner criteria
   */
  private static getMetricValue(variant: ABTestVariant, criteria: ABTest['winner_criteria']): number {
    switch (criteria) {
      case 'open_rate':
        return variant.emails_delivered > 0 ? (variant.emails_opened / variant.emails_delivered) * 100 : 0
      case 'click_rate':
        return variant.emails_opened > 0 ? (variant.emails_clicked / variant.emails_opened) * 100 : 0
      case 'reply_rate':
        return variant.emails_sent > 0 ? (variant.emails_replied / variant.emails_sent) * 100 : 0
      default:
        return 0
    }
  }

  /**
   * Get success count based on winner criteria
   */
  private static getSuccessCount(variant: ABTestVariant, criteria: ABTest['winner_criteria']): number {
    switch (criteria) {
      case 'open_rate':
        return variant.emails_opened
      case 'click_rate':
        return variant.emails_clicked
      case 'reply_rate':
        return variant.emails_replied
      default:
        return 0
    }
  }

  /**
   * Generate recommendations based on test results
   */
  private static generateRecommendations(
    test: ABTest, 
    results: ABTestResult[], 
    status: ABTestAnalysis['status']
  ): string[] {
    const recommendations: string[] = []

    if (status === 'insufficient_data') {
      const totalSent = results.reduce((sum, r) => sum + r.emails_sent, 0)
      const remaining = test.minimum_sample_size - totalSent
      recommendations.push(`Continue test - need ${remaining} more emails to reach minimum sample size`)
    }

    if (status === 'running') {
      recommendations.push('Test is running - wait for completion before making decisions')
    }

    if (status === 'significant') {
      const winner = results.find(r => r.is_winner)
      if (winner) {
        recommendations.push(`Use ${winner.variant_name} - it shows ${winner.lift_percentage.toFixed(1)}% improvement`)
      }
    }

    if (status === 'inconclusive') {
      recommendations.push('No significant difference found - consider running a longer test or testing larger changes')
      
      // Check for low statistical power
      const controlResult = results.find(r => r.is_control)!
      const bestVariant = results.filter(r => !r.is_control).reduce((best, current) => 
        current.metric_value > best.metric_value ? current : best
      )
      
      if (bestVariant.metric_value > controlResult.metric_value) {
        recommendations.push(`${bestVariant.variant_name} shows ${bestVariant.lift_percentage.toFixed(1)}% improvement but not statistically significant`)
      }
    }

    // Performance-based recommendations
    const controlResult = results.find(r => r.is_control)!
    if (controlResult.delivery_rate < 95) {
      recommendations.push('Low delivery rate detected - check email authentication and content')
    }
    
    if (controlResult.open_rate < 20) {
      recommendations.push('Low open rate - consider testing different subject lines')
    }

    return recommendations
  }

  /**
   * Simple hash function for consistent variant assignment
   */
  private static hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Check if test should be automatically stopped
   */
  static shouldStopTest(test: ABTest, analysis: ABTestAnalysis): boolean {
    if (!test.auto_select_winner) return false
    
    return (analysis.sample_size_reached && analysis.duration_completed) ||
           (analysis.status === 'significant' && analysis.statistical_power > 0.8)
  }

  /**
   * Get test status summary
   */
  static getTestSummary(test: ABTest): {
    totalEmails: number
    bestVariant: string
    improvement: number
    daysRemaining: number
    progressPercentage: number
  } {
    const totalEmails = test.variants.reduce((sum, v) => sum + v.emails_sent, 0)
    
    const bestVariant = test.variants.reduce((best, current) => {
      const bestMetric = this.getMetricValue(best, test.winner_criteria)
      const currentMetric = this.getMetricValue(current, test.winner_criteria)
      return currentMetric > bestMetric ? current : best
    })

    const controlVariant = test.variants.find(v => v.is_control)!
    const controlMetric = this.getMetricValue(controlVariant, test.winner_criteria)
    const bestMetric = this.getMetricValue(bestVariant, test.winner_criteria)
    const improvement = controlMetric > 0 ? ((bestMetric - controlMetric) / controlMetric) * 100 : 0

    const daysRemaining = test.started_at ? 
      Math.max(0, test.test_duration_hours - ((Date.now() - new Date(test.started_at).getTime()) / (1000 * 60 * 60))) / 24 : 
      test.test_duration_hours / 24

    const progressPercentage = Math.min(100, (totalEmails / test.minimum_sample_size) * 100)

    return {
      totalEmails,
      bestVariant: bestVariant.name,
      improvement,
      daysRemaining,
      progressPercentage
    }
  }
}"