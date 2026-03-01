import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { makeCounterProvider } from "@willsoto/nestjs-prometheus";
import { ReactionsController } from "./reaction.controller.js";
import { ReactionsService } from "./reaction.service.js";
import { Post, PostSchema } from "../posts/schemas/post.schema.js";
import { Reaction, ReactionSchema } from "./schemas/reaction.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reaction.name, schema: ReactionSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [ReactionsController],
  providers: [
    ReactionsService,
    makeCounterProvider({
      name: "engagement_reactions_total",
      help: "Total number of reactions operations",
      labelNames: ["reaction_type"],
    }),
  ],
})
export class ReactionsModule {}
