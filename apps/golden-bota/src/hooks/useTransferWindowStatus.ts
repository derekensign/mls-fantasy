import { useState, useEffect } from "react";
import { getDraftSettings } from "@mls-fantasy/api";
import useUserStore from "../stores/useUserStore";

// Helper function to extract values from DynamoDB format
const extractValue = (item: any): any => {
  if (item === null || item === undefined) return item;
  if (
    typeof item === "string" ||
    typeof item === "number" ||
    typeof item === "boolean"
  ) {
    return item;
  }
  if (item.S !== undefined) return item.S;
  if (item.N !== undefined) return parseInt(item.N, 10);
  if (item.BOOL !== undefined) return item.BOOL;
  if (item.SS !== undefined) return item.SS;
  if (item.L !== undefined) return item.L;
  return item;
};

export const useTransferWindowStatus = () => {
  const [isTransferWindowActive, setIsTransferWindowActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userDetails } = useUserStore();

  useEffect(() => {
    const checkTransferWindowStatus = async () => {
      if (!userDetails?.leagueId) {
        setLoading(false);
        return;
      }

      try {
        const draftSettings = await getDraftSettings(
          userDetails.leagueId.toString()
        );

        if (draftSettings) {
          // Check if transfer window is currently active based on time comparison only
          const windowStart = extractValue(draftSettings.transfer_window_start);
          const windowEnd = extractValue(draftSettings.transfer_window_end);
          const now = new Date();

          const isActive =
            windowStart &&
            windowEnd &&
            new Date(windowStart) <= now &&
            now <= new Date(windowEnd);

          setIsTransferWindowActive(Boolean(isActive));
        }
      } catch (error) {
        console.error("Error checking transfer window status:", error);
        setIsTransferWindowActive(false);
      } finally {
        setLoading(false);
      }
    };

    checkTransferWindowStatus();

    // Check every 30 seconds for status updates
    const interval = setInterval(checkTransferWindowStatus, 30000);

    return () => clearInterval(interval);
  }, [userDetails?.leagueId]);

  return { isTransferWindowActive, loading };
};
