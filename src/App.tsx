import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Room1 } from './rooms/room1/Room1';
import { Galerie } from './rooms/Gallerie/Gallerie';
import { Room2 } from './rooms/room2/room2';
import PortalGallery from './rooms/PortalGallery';
import Room99 from './rooms/room99/Room99';
import Room2608 from './rooms/room2608/Room2608';
import Room11 from './rooms/room11/Room11';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Galerie />} />
        <Route path="/room1" element={<Room1 />} />
        <Route path='/room2' element={<Room2/>}/>
        <Route path='/room3' element={<PortalGallery/>}/>
        <Route path='/room11' element={<Room11/>}/>
        <Route path='/room99' element={<Room99/>}/>
        {/* atajos de prueba: entran directos a una etapa del room99 */}
        <Route path='/room99/monolito' element={<Room99 skip='monolito'/>}/>
        <Route path='/room99/antro' element={<Room99 skip='antro'/>}/>
        <Route path='/room2608' element={<Room2608/>}/>

      </Routes>
    </Router>
  );
}

export default App;
