import './App.css';
import Spline from '@splinetool/react-spline';
import Chat from './components/Chat';

function App() {
  return (
    <div className="App">
      <div className="spline-container">
        <div className="spline-overlay">
          <Spline scene="https://prod.spline.design/q2c5wAVesDdTQQ8A/scene.splinecode" />
        </div>
        <div className="spline-base">
          <Spline scene="https://prod.spline.design/qX39OiHwKkpiLOPh/scene.splinecode" />
        </div>
      </div>
      
      <Chat />
    </div>
  );
}

export default App;
