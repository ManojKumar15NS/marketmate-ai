import { seoEditorService } from '../tools/seoEditorService.js';

const sample = '<h1>Cloud Migration Strategy Guide</h1><p>Planning an effective cloud migration strategy requires careful assessment, automated tooling, and experienced architecture teams.</p><h2>Phase 1: Readiness Assessment</h2><p>Before moving any workload to the cloud, evaluate legacy dependencies, database schemas, and networking requirements.</p>';

const analysis = seoEditorService.analyzeContent(
  sample,
  'cloud migration strategy',
  'Cloud Migration Strategy Guide: Step-by-Step Architecture',
  'Planning an effective cloud migration strategy requires careful assessment, automated tooling, and experienced architecture teams for modern enterprise systems.'
);

console.log('Overall Score:', analysis.overallScore);
console.log('Word Count:', analysis.wordCount);
console.log('Keyword In Title:', analysis.keywordInTitle);
console.log('Keyword In H1:', analysis.keywordInH1);
console.log('Flesch Reading Ease:', analysis.fleschReadingEase);
console.log('Breakdown count:', analysis.breakdown.length);

if (analysis.wordCount > 30 && analysis.keywordInTitle && analysis.keywordInH1 && analysis.breakdown.length === 10) {
  console.log('SEO Editor calculations test passed!');
  process.exit(0);
} else {
  console.error('SEO Editor calculations test failed!');
  process.exit(1);
}
