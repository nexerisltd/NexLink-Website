import App from '../../../components/App';
export const metadata={title:'Join channel · NexLink.Chat'};
export default function Page({params}){
  return <App startChannel={String(params.code||'').toUpperCase()}/>;
}
