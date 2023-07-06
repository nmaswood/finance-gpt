import { FileToRender } from "@fgpt/precedent-iso";
import { Box } from "@mui/joy";
import React from "react";

import { DisplayExcelFile } from "./display-asset";
import { ForExcel } from "./report";

export const DisplayDerived: React.FC<{
  derived: FileToRender.DerivedTable;
}> = ({ derived: { sheets, output } }) => {
  return (
    <Box
      display="flex"
      width="100%"
      height="100%"
      maxHeight="100%"
      maxWidth="100%"
      overflow="auto"
      padding={2}
    >
      <DisplayExcelFile sheets={sheets} />
      {output && (
        <Box
          display="flex"
          height="100"
          width="100%"
          maxHeight="100%"
          maxWidth="100%"
          overflow="auto"
        >
          <ForExcel output={output} />
        </Box>
      )}
    </Box>
  );
};
