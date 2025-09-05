import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Room1 } from './rooms/room1/Room1';
import { Galerie } from './rooms/Gallerie/Gallerie';
import { CeciliaRoom } from './rooms/C/Cecilia';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Galerie />} />
        <Route path="/room1" element={<Room1 />} />
        <Route path="/c" element={<CeciliaRoom />} />
      </Routes>
    </Router>
  );
}

export default App;
