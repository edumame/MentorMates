interface ProjectSubmissionHeaderProps {
  currentStep: number;
  totalSteps: number;
}

export function ProjectSubmissionHeader({ currentStep, totalSteps }: ProjectSubmissionHeaderProps) {
  return (
    <div className="text-center mb-10">
      <h2 className="text-4xl font-extrabold text-gray-900">
        Create Your Project
      </h2>
      <p className="mt-3 text-lg text-gray-600">
        Start building your project with automatic saving as you go.
        Submit when you&apos;re ready!
      </p>
      <div className="mt-6">
        <p className="text-lg text-gray-700">
          Step {currentStep} of {totalSteps}
        </p>
      </div>
    </div>
  );
}