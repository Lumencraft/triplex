---
"@triplex/server": patch
---

Prevent maximum call stack exceeded errors by limiting TypeScript import resolution depth. Added `skipLibCheck` and `maxNodeModuleJsDepth` compiler options to prevent infinite loops when resolving complex import graphs.
