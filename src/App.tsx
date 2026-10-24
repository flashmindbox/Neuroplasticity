import { lazy, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { ensureInitialised } from './lib/settings';
import Today from './pages/Today';

// Today loads eagerly; every other page is its own chunk.
const Charter = lazy(() => import('./pages/Charter'));
const Drills = lazy(() => import('./pages/Drills'));
const Experiments = lazy(() => import('./pages/Experiments'));
const Focus = lazy(() => import('./pages/Focus'));
const Handbook = lazy(() => import('./pages/Handbook'));
const Interview = lazy(() => import('./pages/Interview'));
const Journal = lazy(() => import('./pages/Journal'));
const Mocks = lazy(() => import('./pages/Mocks'));
const More = lazy(() => import('./pages/More'));
const Progress = lazy(() => import('./pages/Progress'));
const Review = lazy(() => import('./pages/Review'));
const Settings = lazy(() => import('./pages/Settings'));
const Speak = lazy(() => import('./pages/Speak'));
const Tests = lazy(() => import('./pages/Tests'));

export default function App() {
  const [ready, setReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    ensureInitialised().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!location.pathname.startsWith('/handbook')) window.scrollTo({ top: 0 });
  }, [location.pathname]);

  if (!ready) return null;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="charter" element={<Charter />} />
        <Route path="focus" element={<Focus />} />
        <Route path="drills" element={<Drills />} />
        <Route path="journal" element={<Journal />} />
        <Route path="speak" element={<Speak />} />
        <Route path="mocks" element={<Mocks />} />
        <Route path="tests" element={<Tests />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="review" element={<Review />} />
        <Route path="progress" element={<Progress />} />
        <Route path="interview" element={<Interview />} />
        <Route path="handbook/*" element={<Handbook />} />
        <Route path="settings" element={<Settings />} />
        <Route path="more" element={<More />} />
        <Route path="*" element={<Today />} />
      </Route>
    </Routes>
  );
}
