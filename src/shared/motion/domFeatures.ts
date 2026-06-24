// The DOM-animation feature bundle for `LazyMotion`, isolated in its own
// module so Vite can code-split it into a separate async chunk. The base
// app chunk pays only for `LazyMotion` + the `m` component shell (a few
// hundred bytes); the ~15 kB of animation features load lazily the first
// time a motion component mounts. Keeps initial paint under the bundle
// budget (load-first: smooth UI ships before motion does).
//
// Default-exported so `() => import('./domFeatures').then((m) => m.default)`
// matches framer-motion's `LazyFeatureBundle` contract.
export { domAnimation as default } from 'framer-motion';
