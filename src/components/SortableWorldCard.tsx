import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WorldCardFace, type WorldCardFaceOwnProps } from "@/components/WorldCardFace";

/** A draggable local-world tile: the card face, bound to the library board. The whole card is the drag
 *  handle; a small move distance is required to start a drag so a plain click still selects the world.
 *  Deleting lives in the tile's context menu (the grid owns it), so the card draws no delete control. */
function SortableWorldCard(props: WorldCardFaceOwnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    // The tile board slides displaced tiles itself; dnd-kit's layout animation would stack a second
    // offset on the same move, so the card starts twice as far away.
    useSortable({ id: props.world.id, animateLayoutChanges: props.layout === 'grid' ? () => false : undefined });
  const style = {
    // Translate (not Transform): Transform bakes in a scale that resizes the dragged card to the target slot.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  // A blank tile answers nothing and goes nowhere: no click, and no drag, since a gesture that finished
  // over an unnamed card would still commit a real arrangement.
  const handlers = props.loading ? {} : { ...attributes, ...listeners };

  return <WorldCardFace ref={setNodeRef} style={style} {...handlers} {...props} />;
}

export default SortableWorldCard;
