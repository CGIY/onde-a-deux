// This client is server-only. Never forward the application's bearer to PostgREST.
export class StoreError extends Error {
  constructor(status){super('Database request failed');this.status=status;}
}
export class PostgrestStore {
  constructor(url,key,fetcher=fetch){
    if(!url||!key)throw new Error('Missing server database configuration');
    this.url=url.replace(/\/$/,'')+'/rest/v1/';this.key=key;this.fetcher=fetcher;
  }
  async request(path,{method='GET',body,headers={}}={}){
    const response=await this.fetcher(this.url+path,{method,headers:{apikey:this.key,Authorization:'Bearer '+this.key,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw new StoreError(response.status);
    const text=await response.text();return text?JSON.parse(text):null;
  }
  rpc(name,args){return this.request('rpc/'+name,{method:'POST',body:args});}
}
