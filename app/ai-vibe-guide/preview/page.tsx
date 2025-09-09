import React from 'react'
export default function GuidePreview() {
  return (
    <section className="px-5 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Preview Chapter: The AI Vibe Workflow</h1>
        <p className="text-gray-700 mb-6">
          Get a feel for the hands-on, practical approach inside the 2025 Ultimate AI Vibe Coding Guide.
          This preview covers the core workflow to ideate, scaffold, and iterate rapidly using modern AI tooling.
        </p>
        <div className="prose prose-gray max-w-none">
          <h2>1. Set the Vibe</h2>
          <p>Define intent, constraints, and target outcomes. Capture style and tone to guide code generation.</p>
          <h2>2. Scaffold with Precision</h2>
          <p>Generate minimal, runnable skeletons. Avoid premature complexity; ship something that runs first.</p>
          <h2>3. Tighten the Loop</h2>
          <p>Short cycles: run, test, refine. Measure feedback and keep the AI in sync with ground truth.</p>
          <h2>4. Codify Patterns</h2>
          <p>Promote learned tactics into templates. Automate repetitive flows; document as you go.</p>
        </div>
      </div>
    </section>
  )
}

