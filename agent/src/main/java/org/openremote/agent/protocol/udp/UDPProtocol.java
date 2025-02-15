/*
 * Copyright 2019, OpenRemote Inc.
 *
 * See the CONTRIBUTORS.txt file in the distribution for a
 * full listing of individual contributors.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
package org.openremote.agent.protocol.udp;

import io.netty.channel.ChannelHandler;
import org.openremote.model.asset.agent.AgentLink;
import org.openremote.model.attribute.Attribute;
import org.openremote.model.attribute.AttributeEvent;
import org.openremote.model.attribute.AttributeRef;
import org.openremote.model.protocol.ProtocolUtil;
import org.openremote.model.syslog.SyslogCategory;
import org.openremote.model.util.Pair;
import org.openremote.model.value.Values;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.logging.Logger;

import static org.openremote.model.syslog.SyslogCategory.PROTOCOL;

/**
 * This is a UDP client protocol for communicating with UDP servers; it uses the {@link UDPIOClient} to handle the
 * communication and all messages are processed as strings; if you require custom message type handling then
 * sub class the {@link AbstractUDPProtocol}).
 * <p>
 * To use this protocol create a {@link UDPAgent}.
 */
public class UDPProtocol extends AbstractUDPProtocol<UDPProtocol, UDPAgent, AgentLink.Default, String, UDPIOClient<String>> {

    private static final Logger LOG = SyslogCategory.getLogger(PROTOCOL, UDPProtocol.class);
    public static final String PROTOCOL_DISPLAY_NAME = "UDP Client";
    protected final List<Pair<AttributeRef, Consumer<String>>> protocolMessageConsumers = new ArrayList<>();

    public UDPProtocol(UDPAgent agent) {
        super(agent);
    }

    @Override
    public String getProtocolName() {
        return PROTOCOL_DISPLAY_NAME;
    }

    @Override
    protected void doLinkAttribute(String assetId, Attribute<?> attribute, AgentLink.Default agentLink) {

        AttributeRef attributeRef = new AttributeRef(assetId, attribute.getName());
        Consumer<String> messageConsumer = ProtocolUtil.createGenericAttributeMessageConsumer(assetId, attribute, agentLink, timerService::getCurrentTimeMillis, this::updateLinkedAttribute);

        if (messageConsumer != null) {
            protocolMessageConsumers.add(new Pair<>(
                attributeRef,
                messageConsumer
            ));
        }
    }

    @Override
    protected void doUnlinkAttribute(String assetId, Attribute<?> attribute, AgentLink.Default agentLink) {
        AttributeRef attributeRef = new AttributeRef(assetId, attribute.getName());
        protocolMessageConsumers.removeIf(attributeRefConsumerPair -> attributeRefConsumerPair.key.equals(attributeRef));
    }

    @Override
    protected Supplier<ChannelHandler[]> getEncoderDecoderProvider() {
        return getGenericStringEncodersAndDecoders(client.ioClient, agent);
    }

    @Override
    protected void onMessageReceived(String message) {
        protocolMessageConsumers.forEach(attributeRefConsumerPair ->
            attributeRefConsumerPair.value.accept(message));
    }

    @Override
    protected String createWriteMessage(Attribute<?> attribute, AgentLink.Default agentLink, AttributeEvent event, Object processedValue) {
        return Values.convert(processedValue, String.class);
    }
}
