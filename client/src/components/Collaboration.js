import { useYDoc, useYMap } from 'react-yjs';
import { Provider } from 'yjs';

// Assuming you have a workspace ID
const workspaceId = 'some_workspace_id';

const doc = new Provider({
  url: `http://localhost:12345/${workspaceId}`, // Assuming a Yjs server is running
});

const { ydoc } = useYDoc(doc);
const { ymap: textMap } = useYMap(ydoc.getMap('text'), 'text');

return (
  <div>
    <input
      type="text"
      value={textMap.get('text') || ''}
      onChange={(e) => textMap.set('text', e.target.value)}
    />
    {/* Similar for questions or other shared data */}
  </div>
);