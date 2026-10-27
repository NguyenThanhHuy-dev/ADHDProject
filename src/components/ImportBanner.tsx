import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import { useImportTasks } from '../api/hooks';
import { clearLegacyData, readLegacyTasks } from '../api/legacy';

/** Offers to move tasks saved in this browser (from before accounts) into the signed-in account. */
const ImportBanner = () => {
  const [tasks] = useState(() => readLegacyTasks());
  const [hidden, setHidden] = useState(false);
  const importTasks = useImportTasks();

  if (tasks.length === 0 || hidden) return null;

  return (
    <Alert
      severity="info"
      sx={{ mb: 3 }}
      action={
        <>
          <Button
            color="inherit"
            size="small"
            disabled={importTasks.isPending}
            onClick={() =>
              importTasks.mutate(tasks, {
                onSuccess: () => {
                  clearLegacyData();
                  setHidden(true);
                },
              })
            }
          >
            Import
          </Button>
          <Button
            color="inherit"
            size="small"
            disabled={importTasks.isPending}
            onClick={() => {
              clearLegacyData();
              setHidden(true);
            }}
          >
            Discard
          </Button>
        </>
      }
    >
      {importTasks.isError
        ? `Import failed: ${importTasks.error.message}`
        : `Found ${tasks.length} task${tasks.length === 1 ? '' : 's'} saved in this browser. Import them into your account? Points and rewards are earned on the server and are not imported.`}
    </Alert>
  );
};

export default ImportBanner;
