'use client';

/**
 * ConversationalWizard - Question-by-question benchmark submission
 *
 * Presents benchmark questions one at a time in a conversational flow.
 * Features progress tracking, validation, and mobile-responsive design.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import type { BenchmarkCategory } from '@/hooks/useBenchmarks';

export interface WizardQuestion {
  field: string;
  question: string;
  type: 'number' | 'text' | 'select';
  unit?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
}

interface ConversationalWizardProps {
  category: BenchmarkCategory;
  questions: WizardQuestion[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ConversationalWizard({
  category,
  questions,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ConversationalWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = questions[currentStep];
  const isFirstQuestion = currentStep === 0;
  const isLastQuestion = currentStep === questions.length - 1;
  const progress = ((currentStep + 1) / questions.length) * 100;

  // Get current value for display
  const currentValue = formData[currentQuestion?.field] ?? '';

  // Handle value change
  const handleChange = useCallback(
    (value: string) => {
      setError(null);

      // For number fields, convert to number or keep empty string
      if (currentQuestion.type === 'number') {
        const numValue = value === '' ? '' : parseFloat(value);
        setFormData((prev) => ({
          ...prev,
          [currentQuestion.field]: isNaN(numValue as number) ? '' : numValue,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [currentQuestion.field]: value,
        }));
      }
    },
    [currentQuestion]
  );

  // Validate current step
  const validateStep = useCallback(() => {
    if (currentQuestion.required) {
      const value = formData[currentQuestion.field];
      if (value === undefined || value === '' || value === null) {
        setError('This field is required');
        return false;
      }
    }
    return true;
  }, [currentQuestion, formData]);

  // Handle next
  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    setCurrentStep((prev) => prev + 1);
  }, [validateStep]);

  // Handle back
  const handleBack = useCallback(() => {
    setError(null);
    setCurrentStep((prev) => prev - 1);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return;

    // Filter out empty values before submitting
    const cleanedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value !== '' && value !== null && value !== undefined) {
        cleanedData[key] = value;
      }
    }

    await onSubmit(cleanedData);
  }, [validateStep, formData, onSubmit]);

  // Handle key press (Enter to continue)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isLastQuestion) {
          handleSubmit();
        } else {
          handleNext();
        }
      }
    },
    [isLastQuestion, handleSubmit, handleNext]
  );

  // Category display names
  const categoryNames: Record<BenchmarkCategory, string> = {
    COMPENSATION: 'Compensation',
    INFRASTRUCTURE: 'Infrastructure',
    BUSINESS: 'Business Metrics',
    OPERATIONAL: 'Operational',
  };

  return (
    <Card className="overflow-hidden">
      {/* Progress bar */}
      <div className="h-2 bg-muted">
        <div
          className="h-full bg-gold transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1"
          >
            <ArrowLeft size={14} />
            Back to categories
          </button>
          <h2 className="text-lg font-semibold text-foreground">
            {categoryNames[category]} Benchmark
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Question {currentStep + 1} of {questions.length}
          </p>
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-xl sm:text-2xl font-medium text-foreground mb-4">
            {currentQuestion.question}
          </p>

          {/* Input based on type */}
          {currentQuestion.type === 'select' && currentQuestion.options ? (
            <div className="space-y-2">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange(option.value)}
                  className={`
                    w-full p-3 sm:p-4 text-left rounded-[8px] border-2 transition-all
                    ${
                      currentValue === option.value
                        ? 'border-gold bg-gold/10 text-foreground'
                        : 'border-input bg-background text-foreground hover:border-gold/50'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="relative">
              {currentQuestion.unit && currentQuestion.type === 'number' && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currentQuestion.unit}
                </span>
              )}
              <Input
                type={currentQuestion.type === 'number' ? 'number' : 'text'}
                value={currentValue as string}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentQuestion.type === 'number' ? '0' : 'Type your answer...'}
                className={`
                  min-h-[48px] text-lg
                  ${currentQuestion.unit && currentQuestion.type === 'number' ? 'pl-8' : ''}
                `}
                error={error || undefined}
                autoFocus
              />
              {currentQuestion.unit && currentQuestion.type === 'number' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {currentQuestion.unit === '$' ? '' : currentQuestion.unit}
                </span>
              )}
            </div>
          )}

          {currentQuestion.hint && (
            <p className="text-sm text-muted-foreground mt-2">{currentQuestion.hint}</p>
          )}

          {!currentQuestion.required && (
            <p className="text-xs text-muted-foreground mt-2">
              Optional - press Enter to skip
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!isFirstQuestion && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              <ArrowLeft size={16} />
              Back
            </Button>
          )}

          {isLastQuestion ? (
            <Button
              variant="secondary"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              className="w-full sm:w-auto sm:ml-auto order-1 sm:order-2"
            >
              <Send size={16} />
              Submit
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={isSubmitting}
              className="w-full sm:w-auto sm:ml-auto order-1 sm:order-2"
            >
              Next
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
