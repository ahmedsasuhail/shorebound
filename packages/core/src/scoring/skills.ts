/**
 * Canonical skill → match pattern. Patterns use explicit boundaries so "go" never matches "good"
 * and "java" never matches "javascript" (the prototype's bugs).
 */
const B = (p: string) => new RegExp(String.raw`(?<![\w.+#-])(?:${p})(?![\w+#]|\.(?:js|net)\b)`, "i");

export const SKILLS: Record<string, RegExp> = {
  javascript: B(String.raw`javascript|ecmascript|es6`),
  typescript: B(String.raw`typescript`),
  python: B(String.raw`python`),
  java: B(String.raw`java(?!\s*script)`),
  kotlin: B(String.raw`kotlin`),
  go: B(String.raw`golang|go(?=\s+(?:developer|engineer|services?|microservices|backend|programming))`),
  rust: B(String.raw`rust(?=\s|,|\.|$)`),
  "c#": B(String.raw`c#|\.net|dotnet|asp\.net`),
  "c++": B(String.raw`c\+\+|cpp`),
  php: B(String.raw`php|laravel|symfony`),
  ruby: B(String.raw`ruby|rails`),
  scala: B(String.raw`scala`),
  swift: B(String.raw`swift(?:ui)?`),
  react: B(String.raw`react(?:\.js|js)?(?!\s*native)`),
  "react native": B(String.raw`react\s*native`),
  "next.js": B(String.raw`next\.?js`),
  angular: B(String.raw`angular(?:js)?`),
  vue: B(String.raw`vue(?:\.js|js)?|nuxt`),
  "node.js": B(String.raw`node(?:\.js|js)?(?=[\s,./)]|$)`),
  nestjs: B(String.raw`nest\.?js`),
  express: B(String.raw`express(?:\.js|js)?(?=[\s,./)]|$)`),
  graphql: B(String.raw`graphql`),
  "rest api": B(String.raw`rest(?:ful)?\s*apis?|rest\b`),
  html: B(String.raw`html5?`),
  css: B(String.raw`css3?|sass|scss|tailwind`),
  sql: B(String.raw`sql|postgres(?:ql)?|mysql|mariadb|sql server`),
  postgresql: B(String.raw`postgres(?:ql)?`),
  mysql: B(String.raw`mysql`),
  mongodb: B(String.raw`mongo(?:db)?`),
  redis: B(String.raw`redis`),
  elasticsearch: B(String.raw`elastic\s*search|opensearch`),
  kafka: B(String.raw`kafka`),
  rabbitmq: B(String.raw`rabbitmq`),
  aws: B(String.raw`aws|amazon web services|lambda|ec2|s3`),
  gcp: B(String.raw`gcp|google cloud`),
  azure: B(String.raw`azure`),
  docker: B(String.raw`docker|containers?`),
  kubernetes: B(String.raw`kubernetes|k8s|eks|gke|aks`),
  terraform: B(String.raw`terraform|infrastructure as code|iac`),
  "ci/cd": B(String.raw`ci/cd|ci\s*cd|github actions|jenkins|gitlab ci|circleci`),
  microservices: B(String.raw`micro-?services?`),
  serverless: B(String.raw`serverless`),
  testing: B(String.raw`jest|vitest|mocha|cypress|playwright|unit test(?:s|ing)?|tdd`),
  observability: B(String.raw`datadog|cloudwatch|prometheus|grafana|new relic|observability`),
  "machine learning": B(String.raw`machine learning|ml engineer|pytorch|tensorflow|scikit-learn`),
  llm: B(String.raw`llms?|large language models?|genai|generative ai|openai|gemini api|claude`),
  "data engineering": B(String.raw`spark|airflow|dbt|data pipelines?|etl`),
  linux: B(String.raw`linux|bash`),
  git: B(String.raw`git(?!hub actions)`),
};

/** Canonical skills found in text, in taxonomy order. */
export function findSkills(text: string): string[] {
  return Object.entries(SKILLS)
    .filter(([, re]) => re.test(text))
    .map(([k]) => k);
}

export const FRONTEND = new Set(["react", "next.js", "angular", "vue", "html", "css", "javascript", "typescript"]);
export const BACKEND = new Set([
  "node.js",
  "nestjs",
  "express",
  "java",
  "kotlin",
  "go",
  "python",
  "c#",
  "php",
  "ruby",
  "scala",
  "rust",
  "graphql",
  "rest api",
  "sql",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "kafka",
  "rabbitmq",
  "microservices",
]);

/**
 * Languages and frameworks define a stack. Supporting skills (databases, cloud, tooling) appear in
 * almost every posting, so they must not drive a match on their own.
 */
export const CORE_SKILLS = new Set([
  "javascript",
  "typescript",
  "python",
  "java",
  "kotlin",
  "go",
  "rust",
  "c#",
  "c++",
  "php",
  "ruby",
  "scala",
  "swift",
  "react",
  "react native",
  "next.js",
  "angular",
  "vue",
  "node.js",
  "nestjs",
  "express",
  "graphql",
]);
