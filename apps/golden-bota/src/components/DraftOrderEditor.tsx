import React, { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Paper, Button, Typography } from "@mui/material";

export interface FantasyPlayer {
  FantasyPlayerId?: string; // Make optional since Golden Boot data doesn't have this
  TeamName?: string; // Make optional since Golden Boot data doesn't have this
  FantasyPlayerName: string;
  TotalGoals?: number; // Add this for Golden Boot data
}

export interface DraftOrderEditorProps {
  fantasyPlayers: FantasyPlayer[];
  onOrderChange: (order: string[]) => void;
  title?: string; // Optional title prop
}

const DraftOrderEditor: React.FC<DraftOrderEditorProps> = ({
  fantasyPlayers,
  onOrderChange,
  title = "Draft Order (Snake Draft)", // Default title
}) => {
  const [players, setPlayers] = useState<FantasyPlayer[]>([]);
  const [mounted, setMounted] = useState(false);

  // Ensure rendering only happens on the client.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Always use the passed-in fantasyPlayers as the source of truth.
  useEffect(() => {
    setPlayers(fantasyPlayers);
  }, [fantasyPlayers]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newPlayers = Array.from(players);
    const [removed] = newPlayers.splice(result.source.index, 1);
    newPlayers.splice(result.destination.index, 0, removed);
    setPlayers(newPlayers);
    // Use FantasyPlayerName as the identifier since Golden Boot data doesn't have FantasyPlayerId
    onOrderChange(newPlayers.map((p) => p.FantasyPlayerName));
  };

  const randomizeOrder = () => {
    const randomized = Array.from(players).sort(() => Math.random() - 0.5);
    setPlayers(randomized);
    // Use FantasyPlayerName as the identifier
    onOrderChange(randomized.map((p) => p.FantasyPlayerName));
  };

  if (!mounted) return null;

  return (
    <Paper sx={{ backgroundColor: "#B8860B", padding: 2, marginBottom: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Button
        variant="contained"
        onClick={randomizeOrder}
        sx={{ mb: 1, backgroundColor: "black !important" }}
      >
        Randomize Order
      </Button>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="draftOrder">
          {(provided: any) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {players.map((player, index) => (
                <Draggable
                  key={player.FantasyPlayerName}
                  draggableId={player.FantasyPlayerName}
                  index={index}
                >
                  {(provided: any, snapshot: any) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      sx={{
                        padding: 1,
                        marginBottom: 1,
                        backgroundColor: snapshot.isDragging
                          ? "#ddd"
                          : "#f9f9f9",
                        cursor: "move",
                      }}
                    >
                      {player.TeamName ? `${player.TeamName} - ` : ""}
                      {player.FantasyPlayerName}
                      {player.TotalGoals !== undefined &&
                        ` (${player.TotalGoals} goals)`}
                    </Paper>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </Paper>
  );
};

export default DraftOrderEditor;
