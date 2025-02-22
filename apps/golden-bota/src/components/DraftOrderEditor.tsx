import React, { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { Paper, Button, Typography } from "@mui/material";

export interface FantasyPlayer {
  FantasyPlayerId: string;
  TeamName: string;
  FantasyPlayerName: string;
}

export interface DraftOrderEditorProps {
  fantasyPlayers: FantasyPlayer[];
  onOrderChange: (order: string[]) => void;
}

const DraftOrderEditor: React.FC<DraftOrderEditorProps> = ({
  fantasyPlayers,
  onOrderChange,
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
    onOrderChange(newPlayers.map((p) => p.FantasyPlayerId));
  };

  const randomizeOrder = () => {
    const randomized = Array.from(players).sort(() => Math.random() - 0.5);
    setPlayers(randomized);
    onOrderChange(randomized.map((p) => p.FantasyPlayerId));
  };

  if (!mounted) return null;

  return (
    <Paper sx={{ backgroundColor: "#B8860B", padding: 2, marginBottom: 2 }}>
      <Typography variant="h6" gutterBottom>
        Draft Order (Snake Draft)
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
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {players.map((player, index) => (
                <Draggable
                  key={player.FantasyPlayerId}
                  draggableId={player.FantasyPlayerId}
                  index={index}
                >
                  {(provided, snapshot) => (
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
                      {player.TeamName} - {player.FantasyPlayerName}
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
