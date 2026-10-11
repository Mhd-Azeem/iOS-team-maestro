import {createRoot} from 'react-dom/client';
import ReportsPage from '../src/ReportsPage';
import '../src/styles.css';
const api=async(path:string)=>{const r=await fetch('/fixture'+path);const data=await r.json();if(!r.ok)throw new Error(data.error);return data};
createRoot(document.getElementById('root')!).render(<ReportsPage api={api}/>);
