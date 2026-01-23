package me.drownek.example.config;

import eu.okaeri.configs.OkaeriConfig;
import eu.okaeri.configs.annotation.Comment;
import me.drownek.platform.bukkit.commands.LiteCommandsConfig;
import me.drownek.platform.core.annotation.Configuration;
import me.drownek.util.SoundDispatcher;
import me.drownek.util.message.AudibleMessage;
import me.drownek.util.message.SendableMessage;

@SuppressWarnings("CanBeFinal")
@Configuration(path = "messages.{ext}")
public class Messages extends OkaeriConfig {
    public String playerNotFound = "Player not found.";

    // Sendable messages support legacy and minimessage, and placeholders
    public SendableMessage greetMessage = SendableMessage.of("<#67db6c>Hello, %player%!");
    public SendableMessage configReloaded = SendableMessage.of("<#67db6c>Config reloaded!");
    public SendableMessage configReloadFail = SendableMessage.of("<#FF415C>Config failed to load, check console errors!");

    // Message with a sound effect
    public AudibleMessage audibleMessage = AudibleMessage.of("audibleMessage for %player%", SoundDispatcher.defaultSound());

    @Comment("Messages for commands library, note that not all of them are used in the plugin!")
    public LiteCommandsConfig liteCommandsConfig = new LiteCommandsConfig();
}
