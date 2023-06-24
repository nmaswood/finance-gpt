import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { Button, IconButton, useMediaQuery } from "@mui/material";
import Uppy from "@uppy/core";
import React from "react";

import { useFetchFiles } from "../hooks/use-fetch-files";

export const UploadFilesButton: React.FC<{
  uppy: Uppy;
  projectId: string;
  openModal: () => void;
}> = ({ uppy, projectId, openModal }) => {
  const isLargeScreen = useMediaQuery("(min-width:750px)");
  const { mutate } = useFetchFiles(projectId);

  React.useEffect(() => {
    uppy.on("complete", () => {
      mutate();
    });
  }, [uppy, mutate]);

  return isLargeScreen ? (
    <Button
      startIcon={<CloudUploadIcon />}
      onClick={openModal}
      variant="outlined"
      sx={{ height: "40px", whiteSpace: "nowrap" }}
    >
      Upload files
    </Button>
  ) : (
    <IconButton onClick={openModal} color="primary">
      <CloudUploadIcon />
    </IconButton>
  );
};
