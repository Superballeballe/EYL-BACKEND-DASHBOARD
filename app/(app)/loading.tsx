import { Box, LinearProgress, Skeleton, Stack } from "@mui/material";

export default function AppLoading() {
  return (
    <>
      <LinearProgress
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1501,
        }}
      />

      <Box aria-busy aria-label="Loading page">
        {/* Page header skeleton */}
        <Box
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={200} height={36} />
              <Skeleton variant="text" width={280} height={22} sx={{ mt: 0.5 }} />
            </Box>
            <Skeleton variant="rounded" width={140} height={36} sx={{ display: { xs: "none", sm: "block" } }} />
          </Stack>
        </Box>

        {/* Toolbar / filters skeleton */}
        <Box
          sx={{
            mb: 2.5,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            overflow: "hidden",
          }}
        >
          <Box sx={{ p: 2, bgcolor: "grey.50" }}>
            <Skeleton variant="text" width={160} height={28} />
            <Skeleton variant="text" width={220} height={20} sx={{ mt: 0.5 }} />
          </Box>
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={40} />
            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Skeleton variant="rounded" width={160} height={40} />
              <Skeleton variant="rounded" width={160} height={40} />
              <Skeleton variant="rounded" width={120} height={40} />
            </Stack>
          </Box>
        </Box>

        {/* Main content skeleton */}
        <Box
          sx={{
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            p: 2,
          }}
        >
          <Skeleton variant="rounded" height={280} />
        </Box>
      </Box>
    </>
  );
}
